// Almacén de la propuesta de Sectores.
//  - Sectores y sitios REALES de Stage (datos-stage.js): nombre, sitio, línea base, meta, largo, ancho, jerarquía,
//    sector de prueba, ID Dispatch, fechas y trazado del KML.
//  - Métricas DE PRUEBA generadas como en el prototipo del cliente (data.js): eficiencia, último promedio de polvo,
//    IRI, camiones, proyección de polvo y eventos. Son deterministas: los mismos valores en cada carga.
//  - Crear, editar y eliminar se guardan solo en este navegador (localStorage). "Restablecer datos" vuelve a Stage.
(function () {
  "use strict";
  var P = window.PROTO;
  var KEY = "propuesta_sectores_v1";
  var D = window.STAGE_DATA;

  window.SUPPRESSION_GOAL = 90;
  window.TRAFFIC_RULE = { highPerKm: 6, minTrucks: 3, minMinutes: 10 };

  // ---------- Alarmas configuradas (ejemplo, con las reglas del prototipo del cliente) ----------
  // Cada evento del historial lo genera una de estas alarmas: el historial muestra cuál y su condición.
  window.ALARMS = [
    { id: "polvo", type: "Polvo", name: "Polvo sobre el umbral", status: "alert",
      rule: "PM10 mayor a 125 µg/m³ en la medición del sector", notify: "Plataforma y correo" },
    { id: "iri", type: "Irregularidad", name: "Irregularidad del camino (IRI)", status: "warn",
      rule: "IRI desde 0,35 (en deterioro), desde 0,70 (requiere mantenimiento) y desde 1,40 (crítico)", notify: "Plataforma" },
    { id: "trafico", type: "Tráfico alto", name: "Tráfico alto (Dispatch)", status: "warn",
      rule: "6 camiones o más por km (mínimo 3) durante 10 minutos o más", notify: "Plataforma" },
    { id: "proyeccion", type: "Alerta de emisión de polvo", name: "Riesgo de emisión de polvo (predictiva)", status: "alert",
      rule: "Proyección de emisión Alta en las próximas 12 horas", notify: "Plataforma y correo" }
  ];
  window.alarmFor = function (e) {
    return window.ALARMS.filter(function (a) { return a.type === e.type; })[0] || null;
  };

  // ---------- Generadores deterministas ----------
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function daysAgo(n, hour) {
    var d = new Date(); d.setHours(hour, 0, 0, 0); d.setDate(d.getDate() - n); return d.toISOString();
  }
  function pathLengthM(path) {
    var m = 0;
    for (var i = 1; i < path.length; i++) m += P.distM(path[i - 1], path[i]);
    return m;
  }

  // ---------- Eventos de prueba (igual que el prototipo del cliente) ----------
  function iriBand(v) {
    if (v < 0.34) return null;
    if (v < 0.7) return { name: "En deterioro", status: "warn" };
    if (v < 1.4) return { name: "Requiere mantenimiento", status: "alert" };
    return { name: "Crítico", status: "alert" };
  }
  function riskEvent(r, day, hour, maxDensity) {
    for (var k = 0; k < 8; k++) {
      var res = window.dustRisk({
        density: round1(1 + r() * (maxDensity - 1)), dustRatio: round2(0.9 + r() * 0.7),
        rain: Math.floor(r() * 15), humidity: 8 + Math.floor(r() * 25), uv: round1(6 + r() * 5)
      });
      if (res.key === "high") return { at: daysAgo(day, hour), type: window.DUST_PROJECTION.eventType, status: res.status, detail: window.DUST_PROJECTION.alert };
    }
    return null;
  }
  function makeEvents(r, km) {
    var rule = window.TRAFFIC_RULE;
    var trafficPossible = Math.ceil(rule.highPerKm * km) <= 15;
    var n = 3 + Math.floor(r() * 5), list = [];
    for (var i = 0; i < n; i++) {
      var day = Math.floor(r() * 60), hour = 6 + Math.floor(r() * 12), roll = r();
      if (roll >= 0.78) { var re = riskEvent(r, day, hour, trafficPossible ? 9 : 3); if (re) { list.push(re); continue; } }
      if (roll < 0.4 || (roll >= 0.7 && !trafficPossible)) {
        list.push({ at: daysAgo(day, hour), type: "Polvo", status: "alert", detail: "PM10 sobre el umbral (" + (125 + Math.floor(r() * 50)) + " µg/m³)" });
      } else if (roll < 0.7) {
        var v = round2(0.35 + r() * 1.4), b = iriBand(v);
        list.push({ at: daysAgo(day, hour), type: "Irregularidad", status: b.status, detail: "IRI " + v.toFixed(2) + ": " + b.name });
      } else {
        var trucks = Math.max(rule.minTrucks, Math.ceil(rule.highPerKm * km)) + Math.floor(r() * 3);
        list.push({ at: daysAgo(day, hour), type: "Tráfico alto", status: "warn",
          detail: trucks + " camiones en " + km.toFixed(2) + " km (" + (trucks / km).toFixed(1) + "/km) durante " + (rule.minMinutes + Math.floor(r() * 25)) + " min" });
      }
    }
    return list;
  }
  function recentEvents(g, km) {
    var rule = window.TRAFFIC_RULE;
    var trafficPossible = Math.ceil(rule.highPerKm * km) <= 15;
    var hourStart = Math.floor(Date.now() / 3600000) * 3600000;
    var n = 1 + Math.floor(g() * 4), list = [];
    for (var i = 0; i < n; i++) {
      var at = new Date(hourStart - (1 + Math.floor(g() * 22)) * 3600000 + Math.floor(g() * 60) * 60000 + Math.floor(g() * 60) * 1000).toISOString();
      var roll = g();
      if (roll < 0.35) list.push({ at: at, type: "Polvo", status: "alert", detail: "PM10 sobre el umbral (" + (125 + Math.floor(g() * 50)) + " µg/m³)" });
      else if (roll < 0.6) { var v = round2(0.35 + g() * 1.4), b = iriBand(v); list.push({ at: at, type: "Irregularidad", status: b.status, detail: "IRI " + v.toFixed(2) + ": " + b.name }); }
      else if (roll < 0.8 && trafficPossible) {
        var trucks = Math.max(rule.minTrucks, Math.ceil(rule.highPerKm * km)) + Math.floor(g() * 3);
        list.push({ at: at, type: "Tráfico alto", status: "warn", detail: trucks + " camiones en " + km.toFixed(2) + " km (" + (trucks / km).toFixed(1) + "/km) durante " + (rule.minMinutes + Math.floor(g() * 25)) + " min" });
      } else list.push({ at: at, type: window.DUST_PROJECTION.eventType, status: "alert", detail: window.DUST_PROJECTION.alert });
    }
    return list;
  }

  // Eficiencias objetivo del prototipo del cliente: se reparten para que se vean las ocho franjas de la paleta.
  var EFF_TARGETS = [93, 65, 96, 0, 88, 82, 75, 92, 4, 87, 99, 77, 86, 0, 94, 68, 83, 98, 79, 8, 81, 96];

  // Métricas de prueba de un sector (no vienen de Stage).
  function withMetrics(base, order) {
    var s = Object.assign({}, base);
    var seed = hash("sector:" + s.id);
    var r = rng(seed);
    s.path = (s.path || []).filter(function (p) { return p && p.length === 2; });
    var lenM = s.path.length > 1 ? pathLengthM(s.path) : (s.length || 0);
    if (!s.length) s.length = Math.round(lenM * 100) / 100;
    var km = Math.max(0.05, (s.length || lenM || 500) / 1000);
    if (s.baseline == null || !(s.baseline > 0)) s.baseline = round1(10 + r() * 20); else r();
    if (s.goal == null) s.goal = window.SUPPRESSION_GOAL;
    var targetEff = EFF_TARGETS[order % EFF_TARGETS.length];
    var u = r();
    var ratio = targetEff === 0 ? 1.15 + u * 0.35 : 1 - targetEff / 100;
    s.lastAvg = round1(s.baseline * ratio);
    s.efficiency = Math.max(0, Math.min(100, Math.round((s.baseline - s.lastAvg) / s.baseline * 100)));
    s.iri = round2(0.15 + r() * 1.65);
    s.projectedDensity = Math.round(Math.pow(rng(seed ^ 0x9e3779b9)(), 2.5) * 8 * 10) / 10;
    s.initialTrucks = s.path.length > 1 ? Math.min(16, Math.max(1, Math.round(km * (1.2 + r() * 2.4)))) : 0;   // tope por sector: unos 100 camiones por mina
    var rMeta = rng(seed ^ 0x85ebca6b);
    var lastMs = Date.parse(daysAgo(Math.floor(r() * 3), 9 + Math.floor(r() * 8))) + (Math.floor(rMeta() * 59) * 60 + Math.floor(rMeta() * 59)) * 1000;
    if (lastMs > Date.now()) lastMs -= 86400000;
    s.lastAvgDate = new Date(lastMs).toISOString();
    s.iriDate = new Date(lastMs - (4 + Math.floor(rMeta() * 40)) * 60000).toISOString();
    var pr = rng(seed ^ 0xc2b2ae35)();
    s.trafficProfile = pr < 0.4 ? "day" : pr < 0.75 ? "flat" : "night";
    s.events = makeEvents(r, km).concat(recentEvents(rng(seed ^ 0x27d4eb2f), km));
    s.color = P.efficiencyColor(s.efficiency);
    return s;
  }

  // ---------- Persistencia local (crear / editar / eliminar) ----------
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && v.created) return v; } catch (e) { /* sin almacenamiento */ }
    return { created: [], edited: {}, deleted: [], nextId: 100000 };
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
  }

  function siteName(id) {
    var s = D.sitios.filter(function (x) { return x.id === Number(id); })[0];
    return s ? s.name : "—";
  }

  function rawList() {
    var st = load();
    var base = D.sectores.map(function (s) { return Object.assign({}, s, st.edited[s.id] || {}); });
    return base.concat(st.created).filter(function (s) { return st.deleted.indexOf(s.id) < 0; })
      .map(function (s) { s.site_name = siteName(s.site_id); return s; });
  }

  // Orden dentro de cada sitio (alfabético) para repartir las eficiencias de prueba como en el prototipo.
  function build() {
    var list = rawList();
    var bySite = {};
    list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "es"); }).forEach(function (s) {
      (bySite[s.site_id] = bySite[s.site_id] || []).push(s.id);
    });
    return list.map(function (s) { return withMetrics(s, bySite[s.site_id].indexOf(s.id)); });
  }

  window.STORE = {
    sites: function () { return D.sitios.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "es"); }); },
    site: function (id) { return D.sitios.filter(function (x) { return x.id === Number(id); })[0] || null; },
    siteName: siteName,
    list: build,
    get: function (id) { return build().filter(function (s) { return String(s.id) === String(id); })[0] || null; },
    create: function (data) {
      var st = load(), now = new Date().toISOString();
      var s = Object.assign({ baseline_type: "road", hierarchy: 1, testing: false, id_dispatch: null, kml_filename: null }, data,
        { id: st.nextId++, created_at: now, updated_at: now });
      st.created.push(s);
      return save(st) ? s : null;
    },
    update: function (id, data) {
      var st = load(), now = new Date().toISOString();
      id = Number(id);
      var c = st.created.filter(function (x) { return x.id === id; })[0];
      if (c) Object.assign(c, data, { updated_at: now });
      else st.edited[id] = Object.assign({}, st.edited[id] || {}, data, { updated_at: now });
      return save(st);
    },
    remove: function (id) {
      var st = load();
      id = Number(id);
      st.created = st.created.filter(function (x) { return x.id !== id; });
      if (st.deleted.indexOf(id) < 0) st.deleted.push(id);
      return save(st);
    },
    hasLocalChanges: function () { var st = load(); return st.created.length + st.deleted.length + Object.keys(st.edited).length > 0; },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } },
    exportedAt: D.exportado
  };
})();
