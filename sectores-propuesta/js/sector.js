// Interfaz del sector: diseño y lógica del prototipo del cliente (sector.js), con Google Maps y las descargas de la plataforma.
// Datos del sector: reales de Stage. Métricas, gráficos, proyección y eventos: de prueba (store.js y risk.js).
(function () {
  "use strict";
  window.mountShell();

  var P = window.PROTO;
  var esc = P.esc;
  var DARK = false;   // la plataforma se muestra en modo claro

  function $(id) { return document.getElementById(id); }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // Generador pseudoaleatorio determinista (mismos datos de prueba en cada carga).
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var toastTimer;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }

  // ---------- Sector ----------
  var params = new URLSearchParams(window.location.search);
  var S = window.STORE.get(params.get("id"));
  if (!S) { $("notFound").hidden = false; return; }
  var SITE = window.STORE.site(S.site_id);
  S.site = S.site_name;
  S.createdAt = S.created_at;
  S.updatedAt = S.updated_at;

  $("content").hidden = false;
  document.title = S.name + " · Sector";
  $("crumbName").textContent = S.name;
  $("backLink").href = "index.html#s" + S.id;

  // ---------- Datos del sector ----------
  // Solo: nombre, sitio, línea base y meta, más tráfico actual, promedios de la última medición y fechas.
  function renderFields() {
    var bs = P.baselineStatus(S);
    var dustCls = bs ? " val-" + bs.key : "";
    var dustTip = bs ? " title=\"" + esc(bs.text + " (línea base " + fmt1(S.baseline) + " mg/m³)") + "\"" : "";
    var cols = [
      [
        ["Nombre", esc(S.name)],
        ["Sitio", esc(S.site)],
        ["Línea base", fmt1(S.baseline) + " mg/m³"],
        ["Meta", S.goal + "%"]
      ],
      [
        ["Tráfico promedio (últimas 24 h)", "<span id=\"trafficVal\"></span>"],
        ["Promedio de polvo de la última medición",
          "<span class=\"val" + dustCls + "\"" + dustTip + ">" + fmt1(S.lastAvg) + " mg/m³</span>" +
          (bs ? "<span class=\"sr-only\">, " + esc(bs.text) + "</span>" : "") +
          " <span class=\"when\">· " + P.fmtDateTimeShort(S.lastAvgDate) + "</span>"],
        ["Promedio de IRI de la última medición",
          S.iri.toFixed(2) + " <span class=\"when\">· " + P.fmtDateTimeShort(S.iriDate) + "</span>"]
      ],
      [
        ["Fecha de creación", P.fmtDateTimeShort(S.createdAt)],
        ["Fecha de última modificación", P.fmtDateTimeShort(S.updatedAt)]
      ]
    ];
    $("fields").innerHTML = cols.map(function (col) {
      return "<div class=\"fcol\">" + col.map(function (f) {
        return "<div class=\"f\"><b>" + f[0] + ":</b> " + f[1] + "</div>";
      }).join("") + "</div>";
    }).join("");
  }
  renderFields();

  // Tráfico promedio de las últimas 24 horas (Dispatch simulado; mismo dato que la lista de sectores).
  $("trafficVal").textContent = S.traffic24 == null ? "—" : S.traffic24 + " vehículos/h";

  // ---------- Iconos ----------
  var ICON_INFO = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6M12 7.5v.01\" stroke-linecap=\"round\"/></svg>";
  var ICON_WARN = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3l10 18H2L12 3z\" stroke-linejoin=\"round\"/><path d=\"M12 10v5M12 18v.01\" stroke-linecap=\"round\"/></svg>";
  var ICON_EYE = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>";
  var ICON_EYE_OFF = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22\"/><path d=\"M14.1 14.1a3 3 0 1 1-4.2-4.2\"/></svg>";

  function alertBox(kind, text) {
    return "<div class=\"alert " + kind + "\" role=\"" + (kind === "warn" ? "alert" : "status") + "\">" +
      (kind === "warn" ? ICON_WARN : ICON_INFO) + "<div>" + text + "</div></div>";
  }

  // ---------- Mapa (Google Maps; en el prototipo del cliente era Leaflet) ----------
  var path = S.path || [];
  var hasPath = path.length > 1;
  var cum = hasPath ? P.cumulative(path) : [0];
  var total = cum[cum.length - 1];
  var cosLat = Math.cos(((hasPath ? path[0][0] : (SITE && SITE.lat) || 0)) * Math.PI / 180);
  var viewMode = "outline";   // "outline" (trazado) | "kml"
  var layerMode = "heat";     // "heat" (mapa de calor, eficiencia) | "iri"
  var lineVisible = false;    // el trazado empieza oculto, como en la plataforma
  var gmap = null, outlineLayer = [], kmlLayer = [], heatLayer = [], legendDiv = null;
  function ll(p) { return { lat: p[0], lng: p[1] }; }
  function sectorBounds() { var b = new google.maps.LatLngBounds(); path.forEach(function (p) { b.extend(ll(p)); }); return b; }
  function fit() {
    if (!gmap) return;
    if (hasPath) gmap.fitBounds(sectorBounds(), 40);
    else if (SITE && SITE.lat != null) { gmap.setCenter({ lat: SITE.lat, lng: SITE.lng }); gmap.setZoom(14); }
  }
  function setMapOf(list, m) { list.forEach(function (o) { if (o.setMap) o.setMap(m); else o.map = m; }); }

  function renderLegend() {
    if (!legendDiv) return;
    var heat = layerMode === "heat";
    var items = heat ? P.EFFICIENCY_COLOR_RANGES : P.IRI_RANGES;
    legendDiv.innerHTML = "<div class=\"lt\">" + (heat ? "Mapa de calor" : "IRI") + "</div><div class=\"items\">" +
      items.map(function (r) { return "<div class=\"it\"><i style=\"background:" + r.color + "\"></i>" + esc(r.label) + "</div>"; }).join("") + "</div>";
  }

  function applyLine() {
    setMapOf(outlineLayer, null);
    setMapOf(kmlLayer, null);
    if (lineVisible && gmap) setMapOf(viewMode === "outline" ? outlineLayer : kmlLayer, gmap);
    $("lineToggle").innerHTML = (lineVisible ? ICON_EYE : ICON_EYE_OFF) + (lineVisible ? "Ocultar trazo del sector" : "Mostrar trazo del sector");
    $("lineToggle").hidden = !hasPath;
  }

  // Mediciones de prueba a lo largo del sector (una cada 5 m), agrupadas en hexágonos de tamaño fijo en pantalla.
  var rr = mulberry32(hash(S.id + ":celdas"));
  var samples = [];
  for (var d = 0; hasPath && d <= total; d += 5) {
    var e = S.efficiency + 14 * Math.sin(d / 170 + 1) + 7 * Math.sin(d / 47) + (rr() - 0.5) * 10;
    var v = S.iri * (1 + 0.4 * Math.sin(d / 210) + 0.22 * Math.sin(d / 58 + 2)) + (rr() - 0.5) * 0.12;
    samples.push({ d: d, eff: clamp(e, 0, 100), iri: Math.max(0.04, v) });
  }
  function metersPerPixel(z) { return 156543.03392 * cosLat / Math.pow(2, z); }

  function renderHeat() {
    setMapOf(heatLayer, null);
    heatLayer = [];
    if (!gmap || !hasPath) return;
    var R = clamp(6 * metersPerPixel(gmap.getZoom()), 3, 60);
    var bin = R * 1.75, n = Math.ceil(total / bin), si = 0;
    for (var b = 0; b < n; b++) {
      var d0 = b * bin, d1 = Math.min(total, d0 + bin), sumE = 0, sumI = 0, cnt = 0;
      while (si < samples.length && samples[si].d < d1) {
        if (samples[si].d >= d0) { sumE += samples[si].eff; sumI += samples[si].iri; cnt++; }
        si++;
      }
      if (!cnt) continue;
      var mid = (d0 + d1) / 2;
      var c = P.pointAtDistance(path, cum, mid);
      var a = P.pointAtDistance(path, cum, Math.min(total, mid + bin * 0.5));
      var bk = P.pointAtDistance(path, cum, Math.max(0, mid - bin * 0.5));
      var th = Math.atan2((a[1] - bk[1]) * cosLat, a[0] - bk[0]);
      var off = (b % 2 ? 1 : -1) * R * 0.55;
      var cLat = c[0] + (off * -Math.sin(th)) / 111320;
      var cLng = c[1] + (off * Math.cos(th)) / (111320 * cosLat);
      var pts = [];
      for (var k = 0; k < 6; k++) {
        var ang = (60 * k + 30) * Math.PI / 180;
        pts.push({ lat: cLat + R * Math.sin(ang) / 111320, lng: cLng + R * Math.cos(ang) / (111320 * cosLat) });
      }
      var color = layerMode === "heat" ? P.efficiencyColor(sumE / cnt) : P.iriColor(sumI / cnt);
      heatLayer.push(new google.maps.Polygon({ paths: pts, strokeWeight: 0, fillColor: color, fillOpacity: 0.92, clickable: false, map: gmap, zIndex: 5 }));
    }
  }

  // Descargar KML: el archivo del sector (con el nombre de su KML en la plataforma), generado desde su trazado.
  function kmlFileName() { return S.kml_filename || (S.name.replace(/[^\w.-]+/g, "_") + ".kml"); }
  function downloadKml() {
    if (!hasPath) { toast("Este sector no tiene trazado para descargar."); return; }
    var coords = path.map(function (p) { return p[1] + "," + p[0] + ",0"; }).join(" ");
    var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<kml xmlns=\"http://www.opengis.net/kml/2.2\"><Document><name>" + esc(S.name) +
      "</name><Placemark><name>" + esc(S.name) + "</name><LineString><coordinates>" + coords + "</coordinates></LineString></Placemark></Document></kml>";
    saveBlob(new Blob([xml], { type: "application/vnd.google-earth.kml+xml" }), kmlFileName());
  }
  function saveBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function renderMapNotes() {
    var html = "";
    if (viewMode === "kml") {
      html += "<div class=\"file-row\"><span>Archivo: " + esc(kmlFileName()) + "</span>" +
        "<button type=\"button\" class=\"btn-outline-sm\" id=\"dlKml\">Descargar KML</button></div>";
    }
    if (!hasPath) html += alertBox("warn", "Este sector todavía no tiene trazado. Edítalo para dibujarlo o subir su KML.");
    html += alertBox("info", "Mediciones hasta el " + P.fmtDateTime(S.lastAvgDate));
    if (layerMode === "iri") html += alertBox("warn", "Solo los datos recolectados con camionetas muestran cálculos de IRI");
    $("mapNotes").innerHTML = html;
    var dl = $("dlKml");
    if (dl) dl.addEventListener("click", downloadKml);
  }

  $("segView").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    viewMode = b.getAttribute("data-v");
    Array.prototype.forEach.call($("segView").children, function (x) { x.classList.toggle("on", x === b); });
    if (viewMode === "kml" && !lineVisible) lineVisible = true;
    applyLine();
    renderMapNotes();
  });
  $("segLayer").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    layerMode = b.getAttribute("data-l");
    Array.prototype.forEach.call($("segLayer").children, function (x) { x.classList.toggle("on", x === b); });
    renderLegend();
    renderHeat();
    renderMapNotes();
  });
  $("lineToggle").addEventListener("click", function () { lineVisible = !lineVisible; applyLine(); });
  if (window.ResizeObserver) {
    new ResizeObserver(function (entries) { $("mapBox").classList.toggle("narrow", entries[0].contentRect.width < 560); }).observe($("mapBox"));
  }
  applyLine();
  renderMapNotes();

  window.loadGoogleMaps(function (err) {
    if (err) { $("mapMsg").textContent = err.message; return; }
    gmap = new google.maps.Map($("sectorMap"), {
      center: hasPath ? ll(path[Math.floor(path.length / 2)]) : { lat: (SITE && SITE.lat) || 0, lng: (SITE && SITE.lng) || 0 }, zoom: 15,
      mapTypeId: "satellite", tilt: 0, clickableIcons: false, gestureHandling: "greedy",
      mapTypeControl: true, mapTypeControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM, mapTypeIds: ["roadmap", "satellite"] },
      fullscreenControl: true, fullscreenControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
      zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      streetViewControl: false, rotateControl: false, cameraControl: false
    });
    // Leyenda de la capa activa
    legendDiv = document.createElement("div");
    legendDiv.className = "map-legend2";
    gmap.controls[google.maps.ControlPosition.TOP_LEFT].push(legendDiv);
    renderLegend();
    // Centrar en el sector
    var tools = document.createElement("div");
    tools.className = "map-tools";
    tools.innerHTML = "<button type=\"button\" title=\"Centrar en el sector\" aria-label=\"Centrar en el sector\"><svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v4M12 18v4M2 12h4M18 12h4\"/></svg></button>";
    tools.addEventListener("click", fit);
    gmap.controls[google.maps.ControlPosition.RIGHT_CENTER].push(tools);
    if (hasPath) {
      var gp = path.map(ll);
      outlineLayer = [
        new google.maps.Polyline({ path: gp, strokeColor: "#ffffff", strokeWeight: 9, strokeOpacity: 0.9, clickable: false, zIndex: 10 }),
        new google.maps.Polyline({ path: gp, strokeColor: P.efficiencyColor(S.efficiency), strokeWeight: 5, strokeOpacity: 1, clickable: false, zIndex: 11 })
      ];
      kmlLayer = [new google.maps.Polyline({ path: gp, strokeOpacity: 0, clickable: false, zIndex: 11,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#ffd400", strokeWeight: 3, scale: 3 }, offset: "0", repeat: "13px" }] })]
        .concat(gp.map(function (p) {
          return new google.maps.Marker({ position: p, clickable: false, zIndex: 12,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 3.5, fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#ffd400", strokeWeight: 1.5 } });
        }));
    }
    google.maps.event.addListenerOnce(gmap, "idle", function () { $("mapMsg").hidden = true; });
    gmap.addListener("zoom_changed", function () { clearTimeout(gmap._t); gmap._t = setTimeout(renderHeat, 120); });
    fit();
    applyLine();
    renderHeat();
    window.__gmap = gmap;
  });


  // ---------- Selector de periodo (gráfico e historial de eventos) ----------
  var HOUR = 3600000, DAY = 86400000;
  var HISTORY_DAYS = 100;     // los datos de prueba cubren algo más de 3 meses (el filtro admite hasta 3 meses)
  var MAX_RANGE_MONTHS = 3;   // filtros de fecha: hasta 3 meses, a elección del usuario

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function toInput(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  // Periodos rápidos (se aplican al instante) y un rango personalizado con "Desde", "Hasta" y "Aplicar".
  //   opts.presets: [{ key, label, span }]; opts.anchor(): fin del periodo rápido; opts.min() / opts.max(): límites de los datos;
  //   opts.onChange(from, to, presetKey): presetKey es null cuando el rango es personalizado.
  function rangeControl(opts) {
    var host = opts.host;
    host.className = "range no-print";
    host.innerHTML =
      "<div class=\"range-presets\" role=\"group\" aria-label=\"Periodo\">" +
        opts.presets.map(function (p) { return "<button type=\"button\" data-k=\"" + p.key + "\" aria-pressed=\"false\">" + p.label + "</button>"; }).join("") +
      "</div>" +
      "<div class=\"range-custom\">" +
        "<label><span>Desde</span><input type=\"datetime-local\" class=\"r-from\"></label>" +
        "<label><span>Hasta</span><input type=\"datetime-local\" class=\"r-to\"></label>" +
        "<button type=\"button\" class=\"btn-apply\">Aplicar</button>" +
        "<span class=\"range-max\">Periodo máximo: 3 meses</span>" +
      "</div>" +
      "<p class=\"range-error\" role=\"alert\" hidden></p>";
    var buttons = Array.prototype.slice.call(host.querySelectorAll(".range-presets button"));
    var fromEl = host.querySelector(".r-from"), toEl = host.querySelector(".r-to");
    var custom = host.querySelector(".range-custom"), err = host.querySelector(".range-error");
    fromEl.min = toEl.min = toInput(opts.min());
    fromEl.max = toEl.max = toInput(opts.max());

    function showError(msg) { err.textContent = msg; err.hidden = !msg; }
    function mark(key) {
      buttons.forEach(function (b) {
        var on = b.getAttribute("data-k") === key;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      custom.classList.toggle("active", key == null);
    }
    function fill(from, to) { fromEl.value = toInput(from); toEl.value = toInput(to); }

    function preset(key) {
      var p = opts.presets.filter(function (x) { return x.key === key; })[0];
      var to = opts.anchor();
      var from = to - p.span;
      showError("");
      mark(key);
      fill(from, to);
      opts.onChange(from, to, key);
    }
    function apply() {
      var f = new Date(fromEl.value).getTime(), t = new Date(toEl.value).getTime();
      if (!fromEl.value || !toEl.value || isNaN(f) || isNaN(t)) { showError("Elige la fecha de inicio y la de término."); return; }
      if (f >= t) { showError("La fecha de inicio debe ser anterior a la de término."); return; }
      // Periodo máximo: 3 meses de calendario, elegidos por el usuario (por ejemplo, del 15/08 al 15/11).
      var lim = new Date(t); lim.setMonth(lim.getMonth() - MAX_RANGE_MONTHS);
      if (f < lim.getTime()) { showError("El periodo máximo es de " + MAX_RANGE_MONTHS + " meses: con ese término, el inicio puede ser desde el " + P.fmtDateTimeShort(lim.getTime()) + "."); return; }
      var lo = opts.min(), hi = opts.max();
      if (t < lo || f > hi) { showError("Ese periodo está fuera del historial: va desde el " + P.fmtDateTimeShort(lo) + " hasta el " + P.fmtDateTimeShort(hi) + "."); return; }
      var f2 = Math.max(f, lo), t2 = Math.min(t, hi);   // se ajusta a los límites de los datos
      fill(f2, t2);
      showError("");
      mark(null);
      opts.onChange(f2, t2, null);
    }

    buttons.forEach(function (b) { b.addEventListener("click", function () { preset(b.getAttribute("data-k")); }); });
    host.querySelector(".btn-apply").addEventListener("click", apply);
    [fromEl, toEl].forEach(function (el) { el.addEventListener("keydown", function (e) { if (e.key === "Enter") apply(); }); });
    return { preset: preset };
  }

  function emptyState(title, text) {
    return "<div class=\"empty-state\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12h8\" stroke-linecap=\"round\"/></svg><b>" + title + "</b><span>" + text + "</span></div>";
  }

  // ---------- Gráfico: concentración de polvo y promedios de IRI ----------
  // Dos paneles apilados con el mismo eje de tiempo (en vez de dos ejes verticales): polvo arriba con su línea base y
  // zonas verde / amarilla / roja, IRI abajo con las bandas de la plataforma. El zoom y el cursor van sincronizados.
  var DUST_COLOR = "#008FFB", IRI_COLOR = "#00E396";
  var IRI_NAMES = ["Bueno", "En deterioro", "Requiere mantenimiento", "Crítico"];
  var refMs = Date.parse(S.lastAvgDate);       // última medición de polvo
  var iriRefMs = Date.parse(S.iriDate);        // última medición de IRI

  // Mediciones de prueba por minuto de los últimos 100 días: pasadas del equipo por el sector, separadas por horas
  // o días. La última pasada termina en la última medición con los mismos valores de los datos del sector.
  function buildHistory() {
    var dust = [], iri = [], passes = [];
    var gapMin = Math.max(1, Math.ceil((refMs - iriRefMs) / 60000));

    function addPass(endMs, mins, g, lvlD, lvlI, last) {
      passes.push({ start: endMs - mins * 60000, end: endMs });
      for (var j = mins; j >= 0; j--) {
        var dv = (last && j === 0) ? S.lastAvg : Math.max(0.01, lvlD * (0.6 + g() * 0.8));
        dust.push({ t: endMs - j * 60000, v: dv });
      }
      var iriEnd = last ? iriRefMs : endMs;
      var iriMins = last ? mins - gapMin : mins;
      for (var q = iriMins; q >= 0; q--) {
        var iv = (last && q === 0) ? S.iri : Math.max(0.02, lvlI * (0.75 + g() * 0.5));
        iri.push({ t: iriEnd - q * 60000, v: iv });
      }
    }

    var day0 = new Date(refMs); day0.setHours(0, 0, 0, 0);
    for (var off = HISTORY_DAYS - 1; off >= 0; off--) {
      var g = mulberry32(hash(S.id + ":dia:" + off));
      var dayStart = day0.getTime() - off * DAY;
      var lvlD = S.lastAvg * (0.65 + 0.7 * g()) * (1 + 0.15 * Math.sin(off / 4));   // nivel de polvo de ese día
      var lvlI = S.iri * (0.8 + 0.4 * g());
      var lastMins = gapMin + 4 + Math.floor(g() * 10);
      var limit = off === 0 ? (refMs - lastMins * 60000 - 40 * 60000) : dayStart + 22 * HOUR;   // las pasadas previas terminan antes de la última
      var n = [0, 1, 1, 2, 2, 3][Math.floor(g() * 6)];
      var slots = [];
      for (var k = 0; k < n; k++) {
        var mins = 3 + Math.floor(g() * 23);
        var room = limit - (dayStart + 6 * HOUR) - mins * 60000;
        if (room <= 0) continue;
        slots.push({ end: dayStart + 6 * HOUR + Math.floor(g() * room) + mins * 60000, mins: mins });
      }
      slots.sort(function (a, b) { return a.end - b.end; });
      var prevEnd = -Infinity;
      slots.forEach(function (s) {
        if (s.end - s.mins * 60000 < prevEnd + 20 * 60000) return;   // sin pasadas encimadas
        addPass(s.end, s.mins, g, lvlD, lvlI, false);
        prevEnd = s.end;
      });
      if (off === 0) addPass(refMs, lastMins, g, lvlD, lvlI, true);
    }
    return { dust: dust, iri: iri, passes: passes };
  }
  var hist = buildHistory();

  // ---------- Tráfico por hora de los camiones (Dispatch, SIMULADO; la carga no se muestra: aún no se puede medir) ----------
  // Serie continua hora por hora (los camiones circulan todo el día), a diferencia del polvo y el IRI, que solo se miden
  // cuando pasa el equipo. Tráfico = vehículos por hora en el camino del sector. Carga promedio = toneladas por camión,
  // contando los vacíos como 0 (así la calcula la plataforma: carga total / camiones). El patrón del día sigue el perfil
  // de tráfico del sector (de día, de noche o parejo), el mismo de la proyección de emisión de polvo.
  var TRUCK_CAPACITY_T = 290;
  var SHIFT_SHAPE = [0.9, 0.9, 0.85, 0.85, 0.9, 0.95, 0.55, 1.0, 1.05, 1.1, 1.1, 1.1, 0.85, 1.05, 1.1, 1.1, 1.05, 1.0, 0.55, 1.0, 1.0, 0.95, 0.95, 0.9];   // cambios de turno a las 06 y 18 h

  function floorHour(ms) { var d = new Date(ms); d.setMinutes(0, 0, 0); return d.getTime(); }

  function buildDispatch() {
    var out = [];
    var g0 = mulberry32(hash(S.id + ":dispatch"));
    var shareLoaded = 0.38 + 0.24 * g0();                       // (carga: no se muestra; queda solo para no alterar los datos de prueba)
    var end = floorHour(Math.max(Date.now(), refMs));
    for (var t = floorHour(refMs - HISTORY_DAYS * DAY); t <= end; t += HOUR) {
      var dh = window.dispatchHour(S, t), g = dh.g, flow = dh.flow;   // mismo cálculo que el tráfico de la lista
      out.push({ t: t, flow: flow, load: flow ? Math.round(TRUCK_CAPACITY_T * clamp(shareLoaded + (g() - 0.5) * 0.24, 0.2, 0.9)) : null });
    }
    return out;
  }
  var dispatch = buildDispatch();

  // Horas de Dispatch que caen dentro del periodo.
  function dispatchIn(from, to) { return dispatch.filter(function (p) { return p.t + HOUR > from && p.t <= to; }); }

  // Tráfico por hora (veh/h) y carga promedio (t) para el gráfico: una barra por hora; con periodos largos, el promedio de cada día.
  function dispatchSeries(hours, bucket) {
    var traffic = [], load = [];
    if (bucket >= DAY) {
      var acc = {}, keys = [];
      hours.forEach(function (p) {
        var k = bucketStart(p.t, DAY);
        if (!acc[k]) { acc[k] = { f: 0, n: 0, lw: 0 }; keys.push(k); }
        acc[k].f += p.flow; acc[k].n++; acc[k].lw += (p.load || 0) * p.flow;
      });
      keys.sort(function (a, b) { return a - b; }).forEach(function (k) {
        var a = acc[k];
        traffic.push({ x: k, y: Math.round(a.f / a.n) });
        load.push({ x: k, y: a.f ? Math.round(a.lw / a.f) : null });
      });
    } else {
      hours.forEach(function (p) { traffic.push({ x: p.t, y: p.flow }); load.push({ x: p.t, y: p.load }); });
    }
    return { traffic: traffic, load: load };
  }

  // Tope "redondo" de un eje de 4 intervalos: las marcas caen en números enteros y las líneas de la cuadrícula
  // coinciden con las del eje de polvo o de IRI.
  function niceMax(v) {
    var step = v / 4, pow = Math.pow(10, Math.floor(Math.log10(step))), f = step / pow;
    var nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * pow * 4;
  }

  function bucketFor(span) { return span <= 36 * HOUR ? 60000 : span <= 7 * DAY ? 600000 : span <= 31 * DAY ? HOUR : DAY; }
  function bucketStart(t, bucket) {
    var d = new Date(t);
    if (bucket === DAY) d.setHours(0, 0, 0, 0);
    else if (bucket === HOUR) d.setMinutes(0, 0, 0);
    else if (bucket === 600000) d.setMinutes(Math.floor(d.getMinutes() / 10) * 10, 0, 0);
    else d.setSeconds(0, 0);
    return d.getTime();
  }
  // Promedios por bucket; un hueco de más de un bucket y medio corta la línea (no se une lo que nadie midió).
  function aggregate(points, from, to, bucket) {
    var acc = {}, keys = [];
    points.forEach(function (p) {
      if (p.t < from || p.t > to) return;
      var k = bucketStart(p.t, bucket);
      if (!acc[k]) { acc[k] = { s: 0, n: 0 }; keys.push(k); }
      acc[k].s += p.v; acc[k].n++;
    });
    keys.sort(function (a, b) { return a - b; });
    var out = [], prev = null;
    keys.forEach(function (k) {
      if (prev !== null && k - prev > bucket * 1.5) out.push({ x: prev + bucket, y: null });
      out.push({ x: k, y: Math.round(acc[k].s / acc[k].n * 1000) / 1000 });
      prev = k;
    });
    return out;
  }
  // IRI por pasada: el IRI solo se mide cuando pasa la camioneta (unos minutos), así que en un periodo largo se ve como
  // puntos sueltos casi invisibles. Se resume cada pasada (mediciones separadas por menos de 20 min) en su promedio.
  function iriPorPasada(raw) {
    var out = [], g = null;
    raw.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (p) {
      if (!g || p.t - g.fin > 20 * 60000) { g = { ini: p.t, fin: p.t, s: 0, n: 0 }; out.push(g); }
      g.fin = p.t; g.s += p.v; g.n++;
    });
    return out.map(function (g) { var v = g.s / g.n; return { x: Math.round((g.ini + g.fin) / 2), y: Math.round(v * 100) / 100, c: P.iriColor(v), n: g.n }; });
  }
  function inRange(from, to) { return function (p) { return p.t >= from && p.t <= to; }; }
  function mean(arr) { return arr.length ? arr.reduce(function (a, p) { return a + p.v; }, 0) / arr.length : null; }
  function maxV(arr) { return arr.reduce(function (m, p) { return p.v > m ? p.v : m; }, 0); }
  function maxY(arr) { return arr.reduce(function (m, p) { return p.y != null && p.y > m ? p.y : m; }, 0); }
  function fmtDust(v) { return v < 1 ? v.toFixed(2) : fmt1(v); }

  var charts = [];
  function destroyCharts() {
    charts.forEach(function (c) { try { c.destroy(); } catch (e) { /* ya destruido */ } });
    charts = [];
  }

  function stat(label, value, sub, cls) {
    return "<div class=\"stat\"><span class=\"st-l\">" + label + "</span><span class=\"st-v" + (cls ? " " + cls : "") + "\">" + value + "</span>" +
      (sub ? "<span class=\"st-s\">" + sub + "</span>" : "") + "</div>";
  }

  function renderKpis(rawD, rawI, nPasses, hours) {
    var avgD = mean(rawD), avgI = mean(rawI);
    var bs = avgD != null ? P.baselineStatus({ baseline: S.baseline, lastAvg: avgD }) : null;
    var iriIdx = avgI == null ? -1 : P.IRI_RANGES.map(function (r) { return r.color; }).indexOf(P.iriColor(avgI));
    var flowSum = hours.reduce(function (a, p) { return a + p.flow; }, 0);
    var avgT = hours.length ? flowSum / hours.length : null;                                         // vehículos por hora
    $("chartKpis").innerHTML =
      stat("Promedio de polvo", avgD == null ? "—" : fmtDust(avgD) + " <small>mg/m³</small>",
        avgD == null ? "" : (avgD / S.baseline).toFixed(1) + "× la línea base", bs ? "val-" + bs.key : "") +
      stat("Máximo de polvo", rawD.length ? fmtDust(maxV(rawD)) + " <small>mg/m³</small>" : "—", "") +
      stat("Promedio de IRI", avgI == null ? "—" : avgI.toFixed(2), iriIdx < 0 ? "" : IRI_NAMES[iriIdx]) +
      stat("Tráfico promedio", avgT == null ? "—" : Math.round(avgT) + " <small>veh/h</small>", "por hora") +
      stat("Pasadas por el sector", String(nPasses), "");
  }

  function zoneLegend(items) {
    return items.map(function (it) { return "<span><i style=\"background:" + it[0] + "\"></i>" + it[1] + "</span>"; }).join("");
  }

  function chartNoteText(key, from, to, bucket) {
    var per = bucket === 60000 ? "por minuto" : bucket === 600000 ? "cada 10 minutos" : bucket === HOUR ? "por hora" : "por día";
    var dispatchPer = bucket >= DAY ? "el promedio de cada día" : "valores por hora";
    var text;
    if (key) {
      var prev = { "24h": "las 24 horas previas", "7d": "los 7 días previos", "30d": "los 30 días previos" }[key];
      text = "Promedios calculados " + per + " de " + prev + " a la última medición del " + P.fmtDateTime(refMs);
    } else {
      text = "Promedios calculados " + per + " entre el " + P.fmtDateTimeShort(from) + " y el " + P.fmtDateTimeShort(to);
    }
    return text + ". Tráfico de los camiones: datos de Dispatch (simulados en el prototipo), " + dispatchPer + ".";
  }

  // ---------- Los dos gráficos comparten el eje de tiempo ----------
  // Tiempo bajo el cursor en un gráfico (null si está fuera del área de datos).
  function tiempoEn(e, ctx) {
    var g = ctx.w.globals, r = ctx.el.getBoundingClientRect();
    var px = e.clientX - r.left - g.translateX;
    if (px < 0 || px > g.gridWidth) return null;
    return g.minX + px / g.gridWidth * (g.maxX - g.minX);
  }
  // Línea vertical de ubicación en la misma fecha y hora en los dos gráficos, con la hora escrita arriba.
  function lineaComun(t) {
    charts.forEach(function (ch) {
      var el = ch.el, g = ch.w && ch.w.globals; if (!el || !g) return;
      var ln = el.querySelector(".xsync");
      if (!ln) { ln = document.createElement("div"); ln.className = "xsync"; el.style.position = "relative"; el.appendChild(ln); }
      if (t == null || t < g.minX || t > g.maxX) { ln.style.display = "none"; return; }
      ln.style.display = "block";
      ln.style.left = (g.translateX + (t - g.minX) / (g.maxX - g.minX) * g.gridWidth) + "px";
      ln.style.top = g.translateY + "px"; ln.style.height = g.gridHeight + "px";
      ln.setAttribute("data-t", P.fmtDateTimeShort(t));
    });
  }
  // Acercar, desplazar o volver a la vista inicial en un gráfico hace lo mismo en el otro.
  var sincronizando = false;
  function igualarEje(ctx, x) {
    if (sincronizando) return; sincronizando = true;
    charts.forEach(function (ch) {
      if (ch === ctx) return;
      try { if (x && x.min != null && x.max != null) ch.zoomX(x.min, x.max); else ch.resetSeries(false, true); } catch (e) { /* gráfico aún no listo */ }
    });
    sincronizando = false;
  }

  function renderCharts(from, to, key) {
    destroyCharts();
    var bucket = bucketFor(to - from);
    var rawD = hist.dust.filter(inRange(from, to)), rawI = hist.iri.filter(inRange(from, to));
    var hours = dispatchIn(from, to);
    var nPasses = hist.passes.filter(function (p) { return p.end >= from && p.start <= to; }).length;
    renderKpis(rawD, rawI, nPasses, hours);
    $("chartSubtitle").textContent = "Mediciones hasta el " + P.fmtDateTime(refMs);

    var noMeasures = !rawD.length && !rawI.length;
    var empty = noMeasures && !hours.length;
    $("chartBody").hidden = empty;
    $("chartEmpty").hidden = !empty;
    if (empty) {
      $("chartEmpty").innerHTML = emptyState("No hay mediciones en este periodo", "Prueba con un rango más amplio o con otras fechas.");
      $("chartNote").innerHTML = "";
      return;
    }
    $("chartNote").innerHTML = alertBox("info", chartNoteText(key, from, to, bucket)) +
      (noMeasures ? alertBox("warn", "Sin mediciones de polvo ni de IRI en este periodo: solo se muestra el tráfico de los camiones.") : "");

    if (typeof ApexCharts === "undefined") {
      $("chartDust").innerHTML = alertBox("warn", "No se pudo cargar el gráfico (se necesita conexión a internet).");
      $("chartIri").innerHTML = "";
      return;
    }

    var dust = aggregate(hist.dust, from, to, bucket), iri = iriPorPasada(rawI);
    var ds = dispatchSeries(hours, bucket);
    var dustMax = Math.max(maxY(dust) * 1.15, S.baseline * 1.35);
    var iriMax = Math.max(maxY(iri) * 1.15, 0.8);
    // Las áreas de tráfico y de carga usan hasta la mitad del alto: dejan ver la línea de polvo o de IRI.
    var trafMax = niceMax(Math.max(maxY(ds.traffic) * 1.9, 4));
    var fore = DARK ? "#E0E0E0" : "#373d3f";
    var grid = DARK ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 113, 188, 0.15)";
    var extraColor = DARK ? "#94A3B8" : "#64748B";
    var xFmt = bucket === DAY ? "dd MMM yyyy" : "dd MMM yyyy HH:mm";
    var b = S.baseline;

    var es = {
      name: "es",
      options: {
        months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
        shortMonths: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
        days: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
        shortDays: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
        toolbar: {
          exportToSVG: "Descargar SVG", exportToPNG: "Descargar PNG", exportToCSV: "Descargar CSV",
          menu: "Menú", selection: "Selección", selectionZoom: "Zoom de selección",
          zoomIn: "Acercar", zoomOut: "Alejar", pan: "Mover", reset: "Restablecer zoom"
        }
      }
    };

    // Cada panel lleva dos series: la línea medida (polvo o IRI, eje de la izquierda) y el área de Dispatch (tráfico o carga,
    // eje de la derecha). Las dos series de Dispatch van en gris, con poca opacidad, para no confundirse con las zonas de color.
    function base(c) {
      var X = !!c.extraData;   // serie de Dispatch (solo el tráfico, en el panel de polvo)
      return {
        chart: {
          id: c.id, type: "line", height: c.height, background: "transparent", foreColor: fore,
          defaultLocale: "es", locales: [es], toolbar: { show: c.toolbar, autoSelected: "zoom", export: { csv: { filename: S.name + " - " + c.mainName, dateFormatter: function (t) { return P.fmtDateTimeShort(t); } }, svg: { filename: S.name + " - " + c.mainName }, png: { filename: S.name + " - " + c.mainName } } },
          zoom: { enabled: true, type: "x" }, animations: { speed: 350 },
          events: {
            mouseMove: function (e, ctx) { lineaComun(tiempoEn(e, ctx)); },
            mouseLeave: function () { lineaComun(null); },
            zoomed: function (ctx, z) { igualarEje(ctx, z && z.xaxis); },
            scrolled: function (ctx, z) { igualarEje(ctx, z && z.xaxis); }
          }
        },
        theme: { mode: DARK ? "dark" : "light" },
        colors: X ? [c.color, extraColor] : [c.color],
        series: [{ name: c.mainName, type: "line", data: c.mainData }].concat(X ? [{ name: c.extraName, type: "area", data: c.extraData }] : []),
        stroke: { width: X ? [2, 1.5] : [2], curve: X ? ["straight", "stepline"] : ["straight"] },
        fill: { type: "solid", opacity: X ? [1, 0.2] : [1] },
        markers: { size: X ? [3, 0] : [3], strokeWidth: 0, hover: { sizeOffset: 2 } },
        grid: { borderColor: grid, strokeDashArray: 3, padding: { left: 6, right: 6 } },
        legend: { show: false },
        annotations: c.annotations,
        xaxis: {
          type: "datetime", min: from, max: to, tickAmount: 8,
          labels: { show: c.showX, datetimeUTC: false, rotate: -45, hideOverlappingLabels: true,
            datetimeFormatter: { year: "yyyy", month: "dd MMM", day: "dd MMM", hour: "HH:mm", minute: "HH:mm" } },
          axisTicks: { show: c.showX }, tooltip: { enabled: false }
        },
        // Eje de la izquierda: polvo o IRI. Eje de la derecha: tráfico o carga de Dispatch.
        yaxis: [
          { min: 0, max: c.mainMax, tickAmount: 4, labels: { minWidth: 46, formatter: c.mainFmt } }
        ].concat(X ? [
          {
            opposite: true, min: 0, max: c.extraMax, tickAmount: 4,
            title: { text: c.extraAxis, style: { color: extraColor, fontSize: "11px", fontWeight: 500 } },
            labels: { minWidth: 36, maxWidth: 36, style: { colors: [extraColor] }, formatter: function (v) { return v == null ? undefined : String(Math.round(v)); } }
          }
        ] : []),
        tooltip: {
          theme: DARK ? "dark" : "light", x: { format: xFmt },
          y: [
            { formatter: function (v) { return v == null ? undefined : c.mainFmt(v) + c.mainUnit; } }
          ].concat(X ? [{ formatter: function (v) { return v == null ? undefined : Math.round(v) + c.extraUnit; } }] : [])
        }
      };
    }

    // Polvo: línea base y zonas según qué tan cerca está de ella (mismos cortes que el color del promedio).
    // Las anotaciones van en el eje de la izquierda (yAxisIndex 0).
    var dustAnn = {
      yaxis: [
        { yAxisIndex: 0, y: 0, y2: b * 0.9, fillColor: "#16A34A", opacity: 0.10 },
        { yAxisIndex: 0, y: b * 0.9, y2: b * 1.1, fillColor: "#F59E0B", opacity: 0.16 },
        { yAxisIndex: 0, y: b * 1.1, y2: dustMax, fillColor: "#EF4444", opacity: 0.10 },
        {
          yAxisIndex: 0, y: b, borderColor: DARK ? "#E0E0E0" : "#373d3f", strokeDashArray: 4,
          label: { text: "Línea base " + fmt1(b), position: "left", textAnchor: "start", offsetX: 4, offsetY: -2, borderColor: "transparent",
            style: { color: fore, background: "transparent", fontSize: "11px", fontWeight: 600 } }
        }
      ]
    };
    // IRI: bandas de la plataforma.
    var cuts = [0, 0.34, 0.6999, 1.3999, iriMax];
    var iriAnn = { yaxis: P.IRI_RANGES.map(function (r, i) {
      return { yAxisIndex: 0, y: cuts[i], y2: Math.min(cuts[i + 1], iriMax), fillColor: r.color, opacity: 0.16 };
    }).filter(function (a) { return a.y < iriMax; }) };

    var c1 = new ApexCharts($("chartDust"), base({
      id: "sector-polvo", height: 250, toolbar: true, showX: true, color: DUST_COLOR, annotations: dustAnn,
      mainName: "Promedio de polvo", mainData: dust, mainMax: dustMax, mainFmt: fmtDust, mainUnit: " mg/m³",
      extraName: "Tráfico por hora", extraData: ds.traffic, extraMax: trafMax, extraAxis: "Tráfico (veh/h)", extraUnit: " vehículos/h"
    }));
    var o2 = base({
      id: "sector-iri", height: 210, toolbar: true, showX: true, color: IRI_COLOR, annotations: iriAnn,
      mainName: "IRI promedio por pasada", mainData: iri.map(function (p) { return { x: p.x, y: p.y }; }), mainMax: iriMax,
      mainFmt: function (v) { return v.toFixed(2); }, mainUnit: ""
    });
    // Un punto grande por pasada con el color de su banda, unidos con línea punteada (no es una medición continua)
    // y el valor escrito encima cuando hay pocas pasadas.
    var tam = iri.length > 30 ? 5 : 7;
    o2.stroke = { width: [2], curve: ["straight"], dashArray: [5] };
    o2.colors = [DARK ? "#94A3B8" : "#64748B"];
    o2.markers = { size: [tam], strokeWidth: 2, strokeColors: "#fff", hover: { sizeOffset: 2 },
      discrete: iri.map(function (p, i) { return { seriesIndex: 0, dataPointIndex: i, fillColor: p.c, strokeColor: "#fff", size: tam }; }) };
    o2.dataLabels = { enabled: iri.length <= 12, formatter: function (v) { return v == null ? "" : v.toFixed(2); }, offsetY: -10,
      background: { enabled: false }, style: { fontSize: "11px", fontWeight: 600, colors: [fore] } };
    o2.tooltip.y = [{ formatter: function (v) { if (v == null) return undefined;
      var k = P.IRI_RANGES.map(function (r) { return r.color; }).indexOf(P.iriColor(v)); return v.toFixed(2) + " · " + IRI_NAMES[k]; } }];
    var c2 = new ApexCharts($("chartIri"), o2);
    charts.push(c1, c2);
    c1.render();
    c2.render();
    $("chartSync").hidden = false;

    $("dustZones").innerHTML = zoneLegend([["#16A34A", "Por debajo de la línea base"], ["#F59E0B", "Se acerca"], ["#EF4444", "Supera significativamente"]]);
    $("iriZones").innerHTML = zoneLegend(P.IRI_RANGES.map(function (r, i) { return [r.color, IRI_NAMES[i]]; }));
  }

  rangeControl({
    host: $("chartRange"),
    presets: [{ key: "24h", label: "24 horas", span: DAY }, { key: "7d", label: "7 días", span: 7 * DAY }, { key: "30d", label: "30 días", span: 30 * DAY }],
    anchor: function () { return refMs; },
    min: function () { return refMs - HISTORY_DAYS * DAY; },
    max: function () { return Math.max(Date.now(), refMs); },
    onChange: renderCharts
  }).preset("24h");

  // ---------- Proyección de emisión de polvo (próximas 12 horas) ----------
  var ICONS = {
    dust: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a16207\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M6 8h.01M12 6h.01M17 10h.01M9 14h.01M15 16h.01M5 18h.01M19 17h.01\"/></svg>",
    traffic: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1c6fbf\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h11v10H3zM14 9h4l3 3v4h-7\"/><circle cx=\"7\" cy=\"17.5\" r=\"1.8\"/><circle cx=\"17\" cy=\"17.5\" r=\"1.8\"/></svg>",
    humidity: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#c07a00\" stroke-width=\"2\" stroke-linejoin=\"round\"><path d=\"M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z\"/><path d=\"M5 5l14 14\"/></svg>",
    rain: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#e08a00\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/></svg>",
    uv: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#7c3aed\" stroke-width=\"2\"/><text x=\"12\" y=\"15.6\" text-anchor=\"middle\" font-size=\"9\" font-weight=\"700\" fill=\"#7c3aed\">UV</text></svg>",
    ok: "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#14905a\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12l5 5 9-10\"/></svg>"
  };

  var F = window.sectorForecast(S);
  var WF = window.FORECAST;

  function winRange(w) { return WF.hours[w.from].t + " – " + WF.hours[w.to].t; }
  function winRangeText(w) { return WF.hours[w.from].t + " y " + WF.hours[w.to].t; }
  function attr(html) { return esc(html); }

  function chip(x, label, rangeText) {
    var rows = x.factors.map(function (f) { return "<tr><td>" + esc(f.label) + "</td><td>" + esc(f.text) + "</td></tr>"; }).join("");
    var tip = "<div class='t-title'>" + esc(label) + ": " + x.score + "% " + esc(x.lv5.name) + "</div>" +
      "<table class='wx'>" + rows + "</table>" +
      "<div class='t-foot'>" + (rangeText ? "Riesgo más alto entre las " + rangeText + ": pico a las " + x.hour + "." : "Condiciones a las " + x.hour + ".") +
      " " + esc(x.lv5.desc) + "</div>";
    return "<button type=\"button\" class=\"chip\" style=\"--c:" + x.lv5.color + "\" data-tip-html=\"" + attr(tip) + "\" aria-label=\"" + esc(label + ": " + x.score + "% " + x.lv5.name) + "\">" +
      "<span class=\"dot\"></span><b>" + x.score + "%</b><span class=\"lvl\">" + esc(x.lv5.name) + "</span></button>";
  }

  function trendCell() {
    var diff = F.w12.score - F.now.score;
    var t = diff >= 5 ? { cls: "up", ico: "↗", label: "En aumento", verb: "suba" }
      : diff <= -5 ? { cls: "down", ico: "↘", label: "En descenso", verb: "baje" }
      : { cls: "flat", ico: "→", label: "Estable", verb: "se mantenga similar" };
    var a = F.now.lv5.name, b = F.w12.lv5.name;
    var change = a !== b ? a + " → " + b : "Se mantiene " + a;
    var tip = "<div class='t-title'>" + t.ico + " " + t.label + " (" + (diff > 0 ? "+" : "") + diff + " puntos)</div>" +
      "Se espera que el riesgo de polvo " + t.verb + ": de " + F.now.score + "% (" + esc(a) + ") ahora a " + F.w12.score + "% (" + esc(b) + ") en las próximas 12 horas.";
    return "<button type=\"button\" class=\"cellbtn " + t.cls + "\" data-tip-html=\"" + attr(tip) + "\" aria-label=\"Tendencia: " + esc(t.label) + "\">" +
      "<span class=\"trend-ico\">" + t.ico + "</span><span class=\"main\">" + t.label + "<span class=\"sub\">" + esc(change) + "</span></span></button>";
  }

  function driverCell() {
    var wins = [["Próximas 4 h", F.w4], ["Próximas 8 h", F.w8], ["Próximas 12 h", F.w12]];
    var worst = wins.reduce(function (a, b) { return b[1].score > a[1].score ? b : a; });
    var x = worst[1];
    var main, sub, why, act, key;
    if (x.lv5.key === "vl") {
      key = "ok"; main = "Condiciones favorables"; sub = "Todas las ventanas";
      why = "Las condiciones mantienen el riesgo de polvo muy bajo en las próximas 12 horas."; act = "No se necesita riego por la proyección.";
    } else {
      var top = x.factors.reduce(function (a, b) { return b.points > a.points ? b : a; });
      key = top.key;
      var wx = x.wx;
      var m = {
        dust: {
          main: "Polvo elevado · " + top.text,
          why: "La última medición de polvo (" + fmt1(S.lastAvg) + " mg/m³) es " + top.text + " (" + fmt1(S.baseline) + " mg/m³): hay polvo acumulado en el sector.",
          act: "Regar antes del pico para mantener la superficie húmeda."
        },
        traffic: {
          main: "Tráfico intenso · " + top.text,
          why: "Se espera mucho tráfico en el sector (" + top.text + "): el paso de los camiones levanta polvo.",
          act: "Reforzar el riego en las horas de más tráfico."
        },
        humidity: {
          main: "Baja humedad · " + wx.rh + "%",
          why: "Aire seco (" + wx.rh + "% de humedad) que seca el suelo y suelta polvo. Lo favorable es más de 60%.",
          act: "Aumentar la frecuencia de riego en este sector."
        },
        rain: {
          main: "Sin lluvia · " + wx.rain + "%",
          why: "Solo " + wx.rain + "% de probabilidad de lluvia, así que el polvo no se va a asentar solo.",
          act: "Planear el riego: la lluvia no va a ayudar en esta ventana."
        },
        uv: {
          main: "UV alto · " + wx.uv,
          why: "Índice UV alto (" + wx.uv + "): la radiación seca la superficie más rápido.",
          act: "Regar con más frecuencia en las horas de más sol."
        }
      }[key];
      main = m.main; why = m.why; act = m.act;
      sub = worst[0] + ", pico a las " + x.hour;
    }
    var tip = "<div class='t-title'>Factor principal</div>" + esc(why) + "<div class='t-foot'>" + esc(act) + "</div>";
    return "<button type=\"button\" class=\"cellbtn drv\" data-tip-html=\"" + attr(tip) + "\" aria-label=\"Factor principal: " + esc(main) + "\">" +
      ICONS[key] + "<span class=\"main\">" + esc(main) + "<span class=\"sub\">" + esc(sub) + "</span></span></button>";
  }

  function help(label, tip) { return "<button type=\"button\" class=\"help\" aria-label=\"Ayuda: " + esc(label) + "\" data-tip=\"" + esc(tip) + "\">i</button>"; }
  function helpHtml(label, tipHtml) { return "<button type=\"button\" class=\"help\" aria-label=\"Ayuda: " + esc(label) + "\" data-tip-html=\"" + attr(tipHtml) + "\">i</button>"; }

  function renderForecast() {
    var W = WF.windows;
    var th = function (title, helpHtmlStr, sub) {
      return "<th><span class=\"th\">" + title + " " + helpHtmlStr + "</span>" + (sub ? "<small>" + sub + "</small>" : "") + "</th>";
    };
    var legendChips = window.DUST_LEVELS5.map(function (l) {
      var tip = "<div class='t-title'>" + esc(l.name) + ": " + l.min + "% – " + l.max + "%</div>" + esc(l.desc);
      return "<button type=\"button\" class=\"chip\" style=\"--c:" + l.color + "\" data-tip-html=\"" + attr(tip) + "\" aria-label=\"" + esc(l.name + ", " + l.min + " a " + l.max + " por ciento") + "\">" +
        "<span class=\"dot\"></span><span class=\"lvl\">" + esc(l.name) + "</span></button>";
    }).join("");

    $("forecastCard").innerHTML =
      "<div class=\"card-head\">" +
        "<h2 id=\"fcTitle\">Proyección de emisión de polvo " +
          help("Proyección de emisión de polvo", "Riesgo de emisión de polvo de este sector para las próximas 4, 8 y 12 horas. Se calcula con la última medición de polvo, el tráfico esperado y el pronóstico del clima (humedad, lluvia y UV). En la lista de sectores se resume en tres niveles: Baja (muy bajo y bajo), Moderada y Alta (alto y muy alto).") +
        "</h2>" +
        "<div class=\"refresh\"><span>Actualizado " + WF.updated + "</span>" +
          help("hora de actualización", "Hora de la última actualización del pronóstico. Se actualiza cada hora. Usa el botón de refrescar para cargar los datos más recientes.") +
          "<button type=\"button\" class=\"icon-btn no-print\" id=\"refreshBtn\" aria-label=\"Actualizar la proyección\" data-tip=\"Carga la proyección más reciente.\">" +
            "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 0 1-15.5 6.2\"/><path d=\"M3 12a9 9 0 0 1 15.5-6.2\"/><path d=\"M18 2v4h-4\"/><path d=\"M6 22v-4h4\"/></svg>" +
          "</button>" +
        "</div>" +
      "</div>" +
      "<div class=\"wrap\"><table><thead><tr>" +
        th("Ahora", help("Ahora", "Riesgo de polvo actual, según las condiciones de este momento."), WF.hours[0].t) +
        th("Próximas 4 h", help("Próximas 4 horas", "Riesgo de polvo más alto esperado entre las " + winRangeText(W[1]) + ". Pasa el cursor sobre un valor para ver las variables que lo explican."), winRange(W[1])) +
        th("Próximas 8 h", help("Próximas 8 horas", "Riesgo de polvo más alto esperado entre las " + winRangeText(W[2]) + ". Pasa el cursor sobre un valor para ver las variables que lo explican."), winRange(W[2])) +
        th("Próximas 12 h", help("Próximas 12 horas", "Riesgo de polvo más alto esperado entre las " + winRangeText(W[3]) + ". Pasa el cursor sobre un valor para ver las variables que lo explican."), winRange(W[3])) +
        th("Tendencia", helpHtml("Tendencia",
          "<div class='t-title'>¿El riesgo de polvo sube o baja?</div>Compara el riesgo actual (Ahora) con el valor de las próximas 12 h.<br><br>" +
          "<b>↗ En aumento</b>: sube 5 puntos o más<br><b>→ Estable</b>: cambia menos de 5 puntos<br><b>↘ En descenso</b>: baja 5 puntos o más"), "") +
        th("Factor principal", helpHtml("Factor principal",
          "<div class='t-title'>¿Por qué va a haber polvo?</div>La condición que más aumenta el riesgo de polvo, en la ventana con mayor riesgo.<br><br>" +
          "<b>Polvo elevado</b>: la última medición está por encima de lo normal<br><b>Tráfico intenso</b>: el paso de camiones levanta polvo<br>" +
          "<b>Baja humedad</b>: el suelo seco suelta polvo<br><b>Sin lluvia</b>: no hay lluvia que asiente el polvo<br><b>UV alto</b>: el sol seca la superficie más rápido" +
          "<div class='t-foot'>Sirve para planear el riego antes del pico.</div>"), "") +
      "</tr></thead><tbody><tr>" +
        "<td>" + chip(F.now, "Ahora", "") + "</td>" +
        "<td>" + chip(F.w4, "Próximas 4 h", winRangeText(W[1])) + "</td>" +
        "<td>" + chip(F.w8, "Próximas 8 h", winRangeText(W[2])) + "</td>" +
        "<td>" + chip(F.w12, "Próximas 12 h", winRangeText(W[3])) + "</td>" +
        "<td>" + trendCell() + "</td>" +
        "<td>" + driverCell() + "</td>" +
      "</tr></tbody></table></div>" +
      "<div class=\"legend\"><span class=\"lt\">Niveles de riesgo de polvo " +
        help("Niveles de riesgo de polvo", "Escala de riesgo de polvo usada en ABC Dust. Pasa el cursor sobre un nivel para ver su rango.") + "</span>" +
        legendChips + "<span class=\"note\">Los valores muestran el mayor riesgo esperado en cada ventana.</span></div>";

    var rb = $("refreshBtn");
    rb.addEventListener("click", function () {
      rb.classList.remove("spin"); void rb.offsetWidth; rb.classList.add("spin");
      toast("Proyección actualizada (datos simulados: sin cambios).");
    });
    wireTips($("forecastCard"));
  }

  // ---------- Tooltips ----------
  var tipEl = $("tip");
  function showTip(el) {
    var html = el.getAttribute("data-tip-html");
    if (html) tipEl.innerHTML = html; else tipEl.textContent = el.getAttribute("data-tip");
    tipEl.classList.add("show");
    var r = el.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
    var top = r.bottom + 8, left = r.left + r.width / 2 - tr.width / 2;
    if (top + tr.height > window.innerHeight - 8) top = r.top - tr.height - 8;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    tipEl.style.top = top + "px"; tipEl.style.left = left + "px";
  }
  function hideTip() { tipEl.classList.remove("show"); }
  function wireTips(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-tip],[data-tip-html]"), function (el) {
      el.addEventListener("mouseenter", function () { showTip(el); });
      el.addEventListener("mouseleave", hideTip);
      el.addEventListener("focus", function () { showTip(el); });
      el.addEventListener("blur", hideTip);
      el.addEventListener("click", function (e) { e.stopPropagation(); showTip(el); });
    });
  }
  document.addEventListener("click", hideTip);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(); });
  window.addEventListener("scroll", hideTip, true);

  renderForecast();

  // ---------- Historial de eventos del sector ----------
  // Por defecto, las últimas 24 horas; también un periodo rápido (7 o 30 días) o un rango personalizado.
  var EV_COLORS = { alert: "#EF4444", warn: "#F59E0B", ok: "#14B8A6", info: "#29ABE2" };
  var allEvents = (S.events || []).slice().sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); });

  function eventDetail(e) {
    // La alerta de emisión de polvo ya no lleva el enlace "Ver más detalles": esta es la interfaz del sector.
    return esc(e.type === window.DUST_PROJECTION.eventType ? window.DUST_PROJECTION.alert : e.detail);
  }

  // Alarmas configuradas (ejemplo): cada evento indica qué alarma lo registró.
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  function alarmName(e) { var a = window.alarmFor(e); return a ? a.name : "—"; }
  if ($("alarmsBox")) $("alarmsBox").innerHTML = '<div class="ab-head">' + BELL.replace("<svg", '<svg width="16" height="16"') + 'Alarmas configuradas <span class="tag-demo">Ejemplo</span></div>' +
    '<ul class="alarm-list">' + window.ALARMS.map(function (a) {
      return '<li><i class="' + esc(a.status) + '"></i><div><b>' + esc(a.name) + "</b><span>" + esc(a.rule) + " · Aviso: " + esc(a.notify) + '</span></div><span class="alarm-on">Activa</span></li>';
    }).join("") + "</ul>" +
    '<p class="ab-note">Cada evento del historial lo registra una de estas alarmas cuando se cumple su condición. Reglas tomadas del prototipo del cliente; los eventos son datos de prueba.</p>';
  if ($("alarmsBtn")) $("alarmsBtn").addEventListener("click", function () {
    var box = $("alarmsBox"), open = box.hidden;
    box.hidden = !open; this.setAttribute("aria-expanded", String(open));
  });

  var shownEvents = [];
  function renderEvents(from, to) {
    var list = allEvents.filter(function (e) { var t = Date.parse(e.at); return t >= from && t <= to; });
    shownEvents = list;
    $("evCount").textContent = list.length + (list.length === 1 ? " evento" : " eventos") + " · " + P.fmtDateTimeShort(from) + " – " + P.fmtDateTimeShort(to);
    if (!list.length) {
      $("evBody").innerHTML = emptyState("No hay eventos en este periodo", "Prueba con un rango más amplio o con otras fechas.");
      return;
    }
    $("evBody").innerHTML = "<div class=\"wrap\"><table class=\"ev-table\"><thead><tr><th>Fecha y hora</th><th>Evento</th><th>Alarma configurada</th><th>Detalle</th></tr></thead><tbody>" +
      list.map(function (e) {
        return "<tr><td class=\"ev-date\">" + P.fmtDateTimeShort(e.at) + "</td>" +
          "<td><span class=\"ev-type\"><i style=\"background:" + (EV_COLORS[e.status] || EV_COLORS.info) + "\"></i>" + esc(e.type) + "</span></td>" +
          "<td><span class=\"alarm-chip\" title=\"Condición: " + esc((window.alarmFor(e) || {}).rule || "") + "\">" + BELL + esc(alarmName(e)) + "</span></td>" +
          "<td>" + eventDetail(e) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  rangeControl({
    host: $("evRange"),
    presets: [{ key: "24h", label: "Últimas 24 horas", span: DAY }, { key: "7d", label: "7 días", span: 7 * DAY }, { key: "30d", label: "30 días", span: 30 * DAY }],
    anchor: function () { return Date.now(); },
    min: function () { return Date.now() - (HISTORY_DAYS + 2) * DAY; },
    max: function () { return Date.now(); },
    onChange: renderEvents
  }).preset("24h");

  // ---------- Exportar PDF (descarga un archivo, como en la plataforma) ----------
  function dataUrlFromBlob(blob) {
    return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { res(null); }; r.readAsDataURL(blob); });
  }
  function staticMapUrl() {
    if (!hasPath || typeof GOOGLE_MAPS_API_KEY === "undefined") return null;
    var step = Math.max(1, Math.ceil(path.length / 120));
    var pts = path.filter(function (p, i) { return i % step === 0 || i === path.length - 1; }).map(function (p) { return p[0].toFixed(5) + "," + p[1].toFixed(5); }).join("|");
    var col = P.efficiencyColor(S.efficiency).replace("#", "0x") + "ff";
    return "https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&maptype=satellite" +
      "&path=" + encodeURIComponent("color:0xffffffcc|weight:9|" + pts) + "&path=" + encodeURIComponent("color:" + col + "|weight:5|" + pts) +
      "&key=" + encodeURIComponent(GOOGLE_MAPS_API_KEY);
  }
  function imgSize(src) {
    return new Promise(function (res) { var im = new Image(); im.onload = function () { res({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); }; im.onerror = function () { res({ w: 1000, h: 420 }); }; im.src = src; });
  }
  // Imagen satelital del sector (1280x720) con mosaicos de Esri World Imagery y el trazado dibujado encima.
  function tileMapImage() {
    return new Promise(function (resolve) {
      var Wc = 1280, Hc = 720, TS = 256;
      function wpx(p, z) { var sc = TS * Math.pow(2, z), si = Math.sin(p[0] * Math.PI / 180); return [(p[1] + 180) / 360 * sc, (0.5 - Math.log((1 + si) / (1 - si)) / (4 * Math.PI)) * sc]; }
      var z = 19, a, b;
      for (; z > 3; z--) {
        a = [Infinity, Infinity]; b = [-Infinity, -Infinity];
        path.forEach(function (p) { var q = wpx(p, z); a[0] = Math.min(a[0], q[0]); a[1] = Math.min(a[1], q[1]); b[0] = Math.max(b[0], q[0]); b[1] = Math.max(b[1], q[1]); });
        if (b[0] - a[0] < Wc * 0.8 && b[1] - a[1] < Hc * 0.8) break;
      }
      var cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, x0 = cx - Wc / 2, y0 = cy - Hc / 2;
      var cv = document.createElement("canvas"); cv.width = Wc; cv.height = Hc;
      var g = cv.getContext("2d"); g.fillStyle = "#1a2238"; g.fillRect(0, 0, Wc, Hc);
      var tiles = [], n = Math.pow(2, z);
      for (var tx = Math.floor(x0 / TS); tx <= Math.floor((x0 + Wc) / TS); tx++)
        for (var ty = Math.floor(y0 / TS); ty <= Math.floor((y0 + Hc) / TS); ty++) if (ty >= 0 && ty < n) tiles.push([tx, ty]);
      var left = tiles.length, timer = setTimeout(finish, 8000), done = false;
      function finish() {
        if (done) return; done = true; clearTimeout(timer);
        g.lineJoin = "round"; g.lineCap = "round";
        [["#ffffff", 10], [P.efficiencyColor(S.efficiency), 6]].forEach(function (st) {
          g.strokeStyle = st[0]; g.lineWidth = st[1]; g.beginPath();
          path.forEach(function (p, i) { var q = wpx(p, z); if (i) g.lineTo(q[0] - x0, q[1] - y0); else g.moveTo(q[0] - x0, q[1] - y0); });
          g.stroke();
        });
        try { resolve(cv.toDataURL("image/jpeg", 0.88)); } catch (e) { resolve(null); }
      }
      if (!left) { finish(); return; }
      tiles.forEach(function (t) {
        var im = new Image(); im.crossOrigin = "anonymous";
        im.onload = function () { if (!done) g.drawImage(im, t[0] * TS - x0, t[1] * TS - y0, TS, TS); if (--left === 0) finish(); };
        im.onerror = function () { if (--left === 0) finish(); };
        im.src = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + t[1] + "/" + (((t[0] % n) + n) % n);
      });
    });
  }
  async function exportPdf() {
    if (!window.jspdf) { toast("No se pudo cargar el generador de PDF (se necesita conexión a internet)."); return; }
    var busy = document.createElement("div");
    busy.className = "pdf-busy";
    busy.textContent = "Generando PDF…";
    document.body.appendChild(busy);
    try {
      var doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
      var W = doc.internal.pageSize.getWidth(), M = 40, y = 46;
      doc.setFillColor(27, 20, 100); doc.rect(0, 0, W, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(27, 20, 100);
      doc.text("Sector: " + S.name, M, y); y += 16;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(93, 107, 130);
      doc.text(S.site + "  ·  Generado el " + P.fmtDateTime(new Date().toISOString()) + "  ·  Propuesta v" + window.APP_VERSION + " (métricas de prueba)", M, y); y += 14;
      doc.autoTable({
        startY: y, margin: { left: M, right: M }, theme: "grid", styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [0, 113, 188] }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 150 }, 2: { fontStyle: "bold", cellWidth: 150 } },
        head: [["Dato", "Valor", "Dato", "Valor"]],
        body: [
          ["Nombre", S.name, "Tráfico promedio (últimas 24 h)", S.traffic24 == null ? "—" : S.traffic24 + " vehículos/h"],
          ["Sitio", S.site, "Polvo de la última medición", fmt1(S.lastAvg) + " mg/m³ · " + P.fmtDateTimeShort(S.lastAvgDate)],
          ["Línea base", fmt1(S.baseline) + " mg/m³", "IRI de la última medición", S.iri.toFixed(2) + " · " + P.fmtDateTimeShort(S.iriDate)],
          ["Meta de supresión", S.goal + " %", "Eficiencia de supresión", S.efficiency + " %"],
          ["Largo", (S.length ? Number(S.length).toFixed(2) + " m" : "—"), "Ancho", (S.width ? Number(S.width).toFixed(1) + " m" : "—")],
          ["Jerarquía", String(S.hierarchy == null ? "—" : S.hierarchy), "Fecha de creación", P.fmtDateTimeShort(S.createdAt)],
          ["Archivo KML", kmlFileName(), "Última modificación", P.fmtDateTimeShort(S.updatedAt)]
        ]
      });
      y = doc.lastAutoTable.finalY + 14;
      // Mapa satelital del sector: Google Static Maps si la clave lo permite; si no, imagen satelital armada con mosaicos de Esri.
      var img = null, credit = "Imagen © Google";
      var url = staticMapUrl();
      if (url) { try { var r = await fetch(url); if (r.ok && /image/.test(r.headers.get("content-type") || "")) img = await dataUrlFromBlob(await r.blob()); } catch (e) { img = null; } }
      if (!img && hasPath) { img = await tileMapImage(); credit = "Imagen satelital © Esri, Maxar, Earthstar Geographics"; }
      if (img) {
        var mw = W - 2 * M, mh = mw * 360 / 640;
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(27, 20, 100); doc.text("Trazado del sector", M, y); y += 8;
        doc.addImage(img, "JPEG", M, y, mw, mh); y += mh + 10;
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 130, 150); doc.text(credit, M, y); y += 12;
      }
      // Gráficos
      doc.addPage(); y = 46;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(27, 20, 100);
      doc.text("Concentración de polvo y promedios de IRI", M, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(93, 107, 130);
      var note = ($("chartNote").innerText || "").replace(/\s+/g, " ").trim();
      if (note) { var ln = doc.splitTextToSize(note, W - 2 * M); doc.text(ln, M, y); y += ln.length * 11 + 6; }
      var kp = Array.prototype.map.call(document.querySelectorAll("#chartKpis .stat"), function (s) {
        return [s.querySelector(".st-l").innerText, s.querySelector(".st-v").innerText.replace(/\s+/g, " "), (s.querySelector(".st-s") || { innerText: "" }).innerText];
      });
      if (kp.length) {
        doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: "striped", styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [0, 113, 188] }, head: [["Indicador", "Valor", "Detalle"]], body: kp });
        y = doc.lastAutoTable.finalY + 10;
      }
      for (var i = 0; i < charts.length; i++) {
        try {
          var du = await charts[i].dataURI();
          if (du && du.imgURI) { var dim = await imgSize(du.imgURI), cw = W - 2 * M, ch = cw * dim.h / dim.w; if (y + ch > 800) { doc.addPage(); y = 46; } doc.addImage(du.imgURI, "PNG", M, y, cw, ch); y += ch + 8; }
        } catch (e) { /* gráfico no disponible */ }
      }
      // Proyección de emisión de polvo
      doc.addPage(); y = 46;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(27, 20, 100);
      doc.text("Proyección de emisión de polvo (actualizada " + WF.updated + ")", M, y); y += 8;
      function cell(x) { return x.score + "% " + x.lv5.name + " (pico " + x.hour + ")"; }
      doc.autoTable({ startY: y + 4, margin: { left: M, right: M }, theme: "grid", styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [0, 113, 188] },
        head: [["Ahora", "Próximas 4 h", "Próximas 8 h", "Próximas 12 h"]], body: [[cell(F.now), cell(F.w4), cell(F.w8), cell(F.w12)]] });
      y = doc.lastAutoTable.finalY + 8;
      var extra = Array.prototype.map.call(document.querySelectorAll("#forecastCard tbody td .main"), function (m) { return m.innerText.replace(/\s+/g, " "); });
      if (extra.length) { doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(28, 36, 51); doc.text("Tendencia: " + (extra[0] || "—").replace(/→/g, "a").replace(/[↗↘]/g, ""), M, y + 6); doc.text("Factor principal: " + (extra[1] || "—"), M, y + 20); y += 32; }
      // Historial de eventos (periodo elegido en la pantalla)
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(27, 20, 100);
      doc.text("Historial de eventos · " + ($("evCount").textContent || ""), M, y + 14); y += 20;
      doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: "striped", styles: { fontSize: 8.5, cellPadding: 3 }, headStyles: { fillColor: [0, 113, 188] },
        head: [["Fecha y hora", "Evento", "Alarma configurada", "Detalle"]],
        body: shownEvents.length ? shownEvents.map(function (e) { return [P.fmtDateTimeShort(e.at), e.type, alarmName(e), e.type === window.DUST_PROJECTION.eventType ? window.DUST_PROJECTION.alert : e.detail]; }) : [["—", "Sin eventos en el periodo", "", ""]] });
      var pages = doc.internal.getNumberOfPages();
      for (var pg = 1; pg <= pages; pg++) {
        doc.setPage(pg); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 130, 150);
        doc.text("ABC Dust · Propuesta de Sectores v" + window.APP_VERSION + " · página " + pg + " de " + pages, M, 826);
      }
      doc.save("Sector - " + S.name.replace(/[\\/:*?"<>|]+/g, "_") + ".pdf");
      toast("PDF descargado.");
    } catch (e) {
      toast("No se pudo generar el PDF: " + e.message);
    } finally { busy.remove(); }
  }
  $("exportPdf").addEventListener("click", exportPdf);

})();
