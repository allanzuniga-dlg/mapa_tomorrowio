// Lista de sectores. Vista "Mapa" = diseño del cliente (app.js del prototipo) pasado de Leaflet a Google Maps.
// Vista "Tabla" = la vista actual de la plataforma. Buscador, filtro por sitio, Agregar, Editar y Eliminar en ambas.
(function () {
  "use strict";
  window.mountShell();

  var P = window.PROTO;
  var esc = P.esc;
  var EFFICIENCY_COLOR_RANGES = P.EFFICIENCY_COLOR_RANGES;
  var baselineStatus = P.baselineStatus;
  function $(id) { return document.getElementById(id); }

  var all = [];          // todos los sectores (Stage + cambios locales) con sus métricas de prueba
  var sectors = [];      // los que pasan el filtro (sitio, búsqueda, sectores de prueba)
  var selectedId = null;
  var layers = {};       // id -> { halo, line, hit }
  var cards = {};        // id -> tarjeta
  var map = null, info = null, gReady = false;

  // ---------- Preferencias (vista y sitio) ----------
  function getPref(k, d) { try { var v = localStorage.getItem("propuesta_sectores_" + k); return v == null ? d : v; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem("propuesta_sectores_" + k, v); } catch (e) { /* nada */ } }

  // ---------- Utilidades ----------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fmtShortDate(iso) { return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }); }
  function fmtStamp(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function fmtDec(v) { if (v == null || v === "") return "—"; v = Number(v); return v % 1 === 0 ? v.toFixed(1) : String(Math.round(v * 100) / 100); }
  function fmtNum(n) { return Number(n).toFixed(1); }
  function fmtLen(m) { m = Math.round(m || 0); return m >= 1000 ? (m / 1000).toFixed(2) + " km" : m + " m"; }
  function byId(id) { return sectors.filter(function (s) { return String(s.id) === String(id); })[0]; }
  function hasPath(s) { return s.path && s.path.length > 1; }
  function ll(p) { return { lat: p[0], lng: p[1] }; }
  function goToSector(id) { window.location.href = "sector.html?id=" + encodeURIComponent(id); }
  function editSector(id) { window.location.href = "form.html?id=" + encodeURIComponent(id); }

  var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var ICON_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';

  // ---------- Indicadores de la tarjeta (prototipo del cliente) ----------
  function effStatus(s) {
    if (s.efficiency == null || s.goal == null) return null;
    var ratio = s.efficiency / s.goal;
    if (ratio >= 1) return { key: "ok", color: "#16A34A", text: "Supera la meta" };
    if (ratio >= 0.9) return { key: "warn", color: "#F59E0B", text: "Cerca de la meta" };
    return { key: "bad", color: "#EF4444", text: "Bajo la meta" };
  }
  function riskFor(s) { return s.projection || null; }
  function projectionBadge(rk) {
    return rk ? '<span class="pj-badge" style="--rc:' + rk.color + '"><i aria-hidden="true"></i>' + esc(rk.level) + "</span>" : '<span class="pj-badge none">—</span>';
  }
  function projectionInner(s, rk) {
    return '<div class="pj-row"><span class="pj-label">' + esc(window.DUST_PROJECTION.title) + "</span>" + projectionBadge(rk) + "</div>" +
      '<button type="button" class="link pj-link" data-go="' + esc(s.id) + '">' + esc(window.DUST_PROJECTION.link) + "</button>";
  }
  function projectionAlertHtml(s) {
    var rk = riskFor(s);
    if (!rk || rk.key !== "high") return "";
    var D = window.DUST_PROJECTION;
    return '<div class="proj-alert" role="alert"><i aria-hidden="true"></i><p>' + esc(D.alert) + ' <button type="button" class="link" data-go="' + esc(s.id) + '">' + esc(D.link) + "</button>.</p></div>";
  }
  function metricsHtml(s) {
    var es = effStatus(s), bs = baselineStatus(s), html = "";
    if (es) {
      html += '<div class="sc-row"><span>Eficiencia de supresión</span><span class="sc-goal" style="color:' + es.color + '">' + s.efficiency + "%</span></div>" +
        '<div class="bar" role="img" aria-label="Eficiencia ' + s.efficiency + " por ciento, meta " + s.goal + ' por ciento"><i style="width:' + Math.min(100, s.efficiency) +
        "%;background:" + es.color + '"></i><b class="goal-tick" style="left:' + Math.min(100, s.goal) + '%"></b></div>' +
        '<div class="sc-sub"><span>Meta ' + fmtGoal(s.goal) + "%</span><span>" + es.text + "</span></div>";
    }
    if (s.lastAvg != null) {
      var dustCls = bs ? " val-" + bs.key : "";
      var dustTip = bs ? ' title="' + esc(bs.text + " (línea base " + fmtNum(s.baseline) + " mg/m³)") + '"' : "";
      html += '<div class="sc-row m"><span>Promedio de polvo de la última medición</span><span><b class="val' + dustCls + '"' + dustTip + ">" + fmtNum(s.lastAvg) + " mg/m³</b>" +
        (bs ? '<span class="sr-only">, ' + esc(bs.text) + "</span>" : "") + ' <time class="when">· ' + fmtShortDate(s.lastAvgDate) + "</time></span></div>";
    }
    if (s.iri != null) {
      html += '<div class="sc-row m"><span>Promedio de IRI de la última medición</span><span><b>' + s.iri.toFixed(2) + '</b> <time class="when">· ' + fmtShortDate(s.iriDate) + "</time></span></div>";
    }
    html += '<div class="sc-row m"><span>Tráfico actual</span><span><b data-traffic="' + esc(s.id) + '">' + fmtTrucks(truckCount(s.id)) + '</b> <span class="live"><i aria-hidden="true"></i>en vivo</span></span></div>';
    var rk = riskFor(s);
    html += '<div class="proj" style="--rc:' + (rk ? rk.color : "#888") + '">' + projectionInner(s, rk) + "</div>";
    if (!hasPath(s)) html += '<div class="no-path">Este sector no tiene trazado: no aparece en el mapa.</div>';
    return html;
  }
  function fmtGoal(g) { return Math.round(g) === g ? String(g) : String(g); }
  function eventsOf(s) { return (s.events || []).slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); }); }

  // ---------- Filtros ----------
  var siteSel = $("siteSel"), q = $("q"), showTest = $("showTest");
  siteSel.innerHTML = '<option value="all">Todos los sitios</option>' + window.STORE.sites().map(function (s) {
    return '<option value="' + s.id + '">' + esc(s.name) + "</option>";
  }).join("");
  siteSel.value = getPref("sitio", "3");                       // por defecto, Mina Sierra Gorda (la mina del diseño del cliente)
  if (!siteSel.value) siteSel.value = "all";
  showTest.checked = getPref("prueba", "1") === "1";
  q.value = getPref("buscar", "");
  function norm(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function applyFilter() {
    var site = siteSel.value, term = norm(q.value.trim());
    sectors = all.filter(function (s) {
      if (site !== "all" && String(s.site_id) !== site) return false;
      if (!showTest.checked && s.testing) return false;
      if (term && norm(s.name).indexOf(term) < 0 && norm(s.site_name).indexOf(term) < 0) return false;
      return true;
    });
  }
  var qTimer;
  q.addEventListener("input", function () { clearTimeout(qTimer); qTimer = setTimeout(function () { setPref("buscar", q.value); refresh(false); }, 180); });
  siteSel.addEventListener("change", function () { setPref("sitio", siteSel.value); refresh(true); });
  showTest.addEventListener("change", function () { setPref("prueba", showTest.checked ? "1" : "0"); refresh(true); });

  // ---------- Vistas ----------
  var view = new URLSearchParams(location.search).get("vista") || getPref("vista", "mapa");
  function setView(v) {
    view = v === "tabla" ? "tabla" : "mapa";
    setPref("vista", view);
    Array.prototype.forEach.call($("viewSwitch").children, function (b) {
      var on = b.getAttribute("data-view") === view;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $("viewMap").hidden = view !== "mapa";
    $("viewTable").hidden = view !== "tabla";
    if (view === "tabla") renderTable();
    else if (map) { google.maps.event.trigger(map, "resize"); if (!selectedId) fitAll(); }
  }
  $("viewSwitch").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setView(b.getAttribute("data-view")); });

  // ---------- Eliminar ----------
  function askDelete(id) {
    var s = all.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!s) return;
    window.confirmDialog("¿Está seguro?", "Se eliminará el sector «" + s.name + "». Esta acción no se puede deshacer.", "Eliminar").then(function (ok) {
      if (!ok) return;
      if (window.STORE.remove(s.id)) { window.toast("Sector eliminado exitosamente", true); reload(); }
      else window.toast("No se pudo guardar el cambio en este navegador.");
    });
  }

  // ---------- Lista de tarjetas ----------
  var listEl = $("sectorList");
  function buildList() {
    listEl.innerHTML = "";
    cards = {};
    $("sectorCount").textContent = sectors.length + (sectors.length === 1 ? " sector" : " sectores");
    if (!sectors.length) { listEl.innerHTML = '<li class="empty" style="padding:16px">No hay sectores con este filtro.</li>'; return; }
    sectors.forEach(function (s) {
      var li = document.createElement("li");
      var b = document.createElement("div");
      b.className = "sector-card";
      b.style.setProperty("--c", s.color);
      b.innerHTML =
        '<div class="sc-top"><button type="button" class="sc-select" aria-pressed="false">' + esc(s.name) + (s.testing ? '<span class="tag-test">Prueba</span>' : "") +
          (siteSel.value === "all" ? "<small>" + esc(s.site_name) + "</small>" : "") + "</button>" +
          '<span class="sc-acts"><button type="button" class="icon-act" data-edit="' + esc(s.id) + '" aria-label="Editar ' + esc(s.name) + '" title="Editar">' + ICON_EDIT + "</button>" +
          '<button type="button" class="icon-act del" data-del="' + esc(s.id) + '" aria-label="Eliminar ' + esc(s.name) + '" title="Eliminar">' + ICON_DEL + "</button></span></div>" +
        metricsHtml(s) +
        '<div class="sc-row foot"><span>' + fmtLen(s.length) + '</span><span>' + (function (n) { return n + (n === 1 ? " evento" : " eventos"); })((s.events || []).length) + "</span></div>";
      b.addEventListener("click", function (ev) {
        var t = ev.target.closest && ev.target.closest("[data-go],[data-edit],[data-del]");
        if (t && t.hasAttribute("data-go")) { goToSector(t.getAttribute("data-go")); return; }
        if (t && t.hasAttribute("data-edit")) { editSector(t.getAttribute("data-edit")); return; }
        if (t && t.hasAttribute("data-del")) { askDelete(t.getAttribute("data-del")); return; }
        select(s.id, "list");
      });
      li.appendChild(b);
      listEl.appendChild(li);
      cards[s.id] = b;
    });
  }

  // ---------- Historial de eventos (generados por las alarmas configuradas) ----------
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  function alarmChip(e) {
    var a = window.alarmFor(e);
    return a ? '<span class="alarm-chip" title="Condición: ' + esc(a.rule) + '">' + BELL + "Alarma configurada: " + esc(a.name) + "</span>" : "";
  }
  function eventItem(e, s, withSector) {
    var detail = esc(e.detail);
    if (e.type === window.DUST_PROJECTION.eventType) detail += ' <button type="button" class="link" data-go="' + esc(s.id) + '">' + esc(window.DUST_PROJECTION.link) + "</button>.";
    var where = withSector ? '<div class="ev-sector"><button type="button" class="link" data-sel="' + esc(s.id) + '">' + esc(s.name) + "</button></div>" : "";
    return '<li><span class="dot ' + esc(e.status) + '" aria-hidden="true"></span><div><div class="ev-type">' + esc(e.type) + "</div>" + where +
      '<div class="ev-detail">' + detail + "</div>" + alarmChip(e) + "</div>" +
      '<time class="ev-date" datetime="' + esc(e.at) + '">' + fmtDate(e.at) + "</time></li>";
  }
  function renderAlarms() {
    $("alarmsBox").innerHTML = '<div class="ab-head">' + BELL.replace("<svg", '<svg width="16" height="16"') + 'Alarmas configuradas <span class="tag-demo">Ejemplo</span></div>' +
      '<ul class="alarm-list">' + window.ALARMS.map(function (a) {
        return '<li><i class="' + esc(a.status) + '"></i><div><b>' + esc(a.name) + "</b><span>" + esc(a.rule) + " · Aviso: " + esc(a.notify) + '</span></div><span class="alarm-on">Activa</span></li>';
      }).join("") + "</ul>" +
      '<p class="ab-note">Cada evento del historial lo registra una de estas alarmas cuando se cumple su condición. Reglas tomadas del prototipo del cliente; los eventos son datos de prueba.</p>';
  }
  renderAlarms();
  $("alarmsBtn").addEventListener("click", function () {
    var box = $("alarmsBox"), open = box.hidden;
    box.hidden = !open; this.setAttribute("aria-expanded", String(open));
  });
  function renderEvents() {
    var titleEl = $("eventsTitle"), countEl = $("eventsCount"), body = $("eventsBody");
    var s = selectedId != null ? byId(selectedId) : null;
    if (!s) {
      // Sin sector elegido: ejemplos con los eventos más recientes de los sectores filtrados.
      var all = [];
      sectors.forEach(function (o) { (o.events || []).forEach(function (e) { all.push({ e: e, s: o }); }); });
      all.sort(function (a, b) { return new Date(b.e.at) - new Date(a.e.at); });
      var top = all.slice(0, 8);
      titleEl.textContent = "Historial de eventos";
      countEl.textContent = top.length ? "Últimos " + top.length + " de " + all.length : "";
      body.innerHTML = top.length
        ? '<p class="ev-intro">Eventos más recientes de los sectores visibles, registrados por las alarmas configuradas. Selecciona un sector para ver solo los suyos.</p><ul class="events">' +
          top.map(function (x) { return eventItem(x.e, x.s, true); }).join("") + "</ul>"
        : '<p class="empty">No hay eventos en los sectores visibles.</p>';
      return;
    }
    titleEl.textContent = "Eventos · " + s.name;
    var list = eventsOf(s);
    countEl.textContent = list.length + (list.length === 1 ? " evento" : " eventos");
    if (!list.length) { body.innerHTML = projectionAlertHtml(s) + '<p class="empty">Este sector no tiene eventos registrados.</p>'; return; }
    body.innerHTML = projectionAlertHtml(s) + '<ul class="events">' + list.map(function (e) { return eventItem(e, s, false); }).join("") + "</ul>";
  }
  $("eventsBody").addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-go]"); if (b) { goToSector(b.getAttribute("data-go")); return; }
    var c = ev.target.closest && ev.target.closest("[data-sel]"); if (c) { var t = byId(c.getAttribute("data-sel")); if (t) select(t.id, "list"); }
  });
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest(".popup [data-go]");
    if (b) goToSector(b.getAttribute("data-go"));
  });

  // ---------- Mapa (Google Maps) ----------
  function lineOpts(s, state) {
    return { strokeColor: s.color, strokeOpacity: 1, strokeWeight: state === "active" ? 9 : state === "hover" ? 8 : 6, zIndex: state === "active" ? 30 : 20 };
  }
  function haloOpts(state) {
    return { strokeColor: "#ffffff", strokeOpacity: state === "active" ? 0.95 : 0.55, strokeWeight: state === "active" ? 15 : 10, zIndex: state === "active" ? 29 : 10 };
  }
  var hoverTip = $("hoverTip");
  function clearLayers() {
    Object.keys(layers).forEach(function (k) { var l = layers[k]; l.halo.setMap(null); l.line.setMap(null); l.hit.setMap(null); if (l.label) l.label.map = null; });
    layers = {};
  }
  function buildLayers() {
    clearLayers();
    if (!gReady) return;
    var showLabels = $("lyLabels").checked;
    sectors.forEach(function (s) {
      if (!hasPath(s)) return;
      var path = s.path.map(ll);
      var halo = new google.maps.Polyline(Object.assign({ path: path, map: map, clickable: false }, haloOpts("base")));
      var line = new google.maps.Polyline(Object.assign({ path: path, map: map, clickable: false }, lineOpts(s, "base")));
      var hit = new google.maps.Polyline({ path: path, map: map, strokeOpacity: 0.001, strokeWeight: 22, zIndex: 40 });
      hit.addListener("click", function () { select(s.id, "map"); });
      hit.addListener("mouseover", function () { if (s.id !== selectedId) line.setOptions(lineOpts(s, "hover")); hoverTip.textContent = s.name; hoverTip.hidden = false; });
      hit.addListener("mousemove", function (e) {
        var r = $("mapWrap").getBoundingClientRect(), de = e.domEvent;
        if (de && de.clientX != null) { hoverTip.style.left = (de.clientX - r.left) + "px"; hoverTip.style.top = (de.clientY - r.top) + "px"; }
      });
      hit.addListener("mouseout", function () { if (s.id !== selectedId) line.setOptions(lineOpts(s, "base")); hoverTip.hidden = true; });
      var lab = null;
      if (showLabels && google.maps.marker) {
        var el = document.createElement("div");
        el.className = "sec-label";
        el.textContent = s.name;
        lab = new google.maps.marker.AdvancedMarkerElement({ map: map, position: ll(s.path[Math.floor(s.path.length / 2)]), content: el, zIndex: 5 });
      }
      layers[s.id] = { halo: halo, line: line, hit: hit, label: lab };
    });
  }
  function boundsOf(list) {
    var b = new google.maps.LatLngBounds(), any = false;
    list.forEach(function (s) { if (hasPath(s)) s.path.forEach(function (p) { b.extend(ll(p)); any = true; }); });
    return any ? b : null;
  }
  function fitAll() {
    if (!gReady) return;
    var b = boundsOf(sectors);
    if (b) map.fitBounds(b, 40);
    else {
      var site = window.STORE.site(siteSel.value);
      if (site && site.lat != null) { map.setCenter({ lat: site.lat, lng: site.lng }); map.setZoom(14); }
    }
  }
  function popupHtml(s) {
    return '<div class="popup"><h3>' + esc(s.name) + "</h3><dl>" +
      "<dt>Eficiencia de supresión</dt><dd>" + (s.efficiency == null ? "—" : s.efficiency + "% (meta " + fmtGoal(s.goal) + "%)") + "</dd>" +
      (s.lastAvg == null ? "" : "<dt>Promedio de polvo de la última medición</dt><dd>" + fmtNum(s.lastAvg) + " mg/m³ · " + fmtShortDate(s.lastAvgDate) + "</dd>") +
      (s.iri == null ? "" : "<dt>Promedio de IRI de la última medición</dt><dd>" + s.iri.toFixed(2) + " · " + fmtShortDate(s.iriDate) + "</dd>") +
      '<dt>Tráfico actual</dt><dd data-traffic="' + esc(s.id) + '">' + fmtTrucks(truckCount(s.id)) + "</dd>" +
      "<dt>" + esc(window.DUST_PROJECTION.title) + "</dt><dd>" + projectionBadge(riskFor(s)) + "</dd></dl>" +
      '<button type="button" class="btn btn-primary" data-go="' + esc(s.id) + '">Ir a la interfaz del sector</button></div>';
  }

  // ---------- Selección (mapa <-> lista) ----------
  function select(id, source) {
    selectedId = id;
    var s = byId(id);
    if (!s) return;
    sectors.forEach(function (o) {
      var active = o.id === id, l = layers[o.id];
      if (l) { l.line.setOptions(lineOpts(o, active ? "active" : "base")); l.halo.setOptions(haloOpts(active ? "active" : "base")); }
      if (cards[o.id]) { cards[o.id].classList.toggle("active", active); cards[o.id].querySelector(".sc-select").setAttribute("aria-pressed", active ? "true" : "false"); }
    });
    if (gReady && hasPath(s)) {
      if (source === "list") {
        var b = boundsOf([s]);
        map.fitBounds(b, 90);
        google.maps.event.addListenerOnce(map, "idle", function () { if (map.getZoom() > 17) map.setZoom(17); });
      }
      var hd = document.createElement("h3");
      hd.className = "iw-title";
      hd.textContent = s.name;
      info.setHeaderContent(hd);
      info.setContent(popupHtml(s).replace("<h3>" + esc(s.name) + "</h3>", ""));
      info.setPosition(ll(s.path[Math.floor(s.path.length / 2)]));
      info.open({ map: map });
    } else if (info) info.close();
    if (cards[id] && source !== "keep") {   // desplaza solo la lista lateral, no la página
      var cr = cards[id].getBoundingClientRect(), lr = listEl.getBoundingClientRect();
      if (cr.top < lr.top || cr.bottom > lr.bottom) listEl.scrollTo({ top: listEl.scrollTop + cr.top - lr.top - 12, behavior: "smooth" });
    }
    syncFleet(true);
    renderEvents();
  }

  // ---------- Camiones en vivo (SIMULACIÓN de Dispatch, como en el prototipo del cliente) ----------
  var trucks = [], sectorStats = {}, clusters = {}, tickTimer = null;
  var SIM_SPEEDUP = 8, JOIN_RADIUS_M = 120;
  function truckCount(id) { return sectorStats[id] ? sectorStats[id].n : 0; }
  function fmtTrucks(n) { return n + (n === 1 ? " camión" : " camiones"); }
  function pointAt(s, d) { return P.pointAtDistance(s.path, s._cum, d); }
  function bearing(a, b) {
    var dLat = b[0] - a[0], dLng = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180);
    return (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
  }
  function truckSvg() {
    return '<svg class="tk-svg" viewBox="-11 -11 22 22" aria-hidden="true"><path class="halo" d="M0,-9.5 L8,9 L0,4.6 L-8,9 Z"/><path class="body" d="M0,-9.5 L8,9 L0,4.6 L-8,9 Z"/><path class="cut" d="M0,-2.4 L2.5,3.6 L0,2.2 L-2.5,3.6 Z"/></svg>';
  }
  function clusterSvg(n, loaded) {
    var p = n ? Math.round(loaded / n * 100) : 0, fs = String(n).length > 2 ? 11 : 13;
    return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#0b1020" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="20" cy="20" r="14" fill="none" stroke="#EF4444" stroke-width="5"/>' +
      '<circle cx="20" cy="20" r="14" fill="none" stroke="#22C55E" stroke-width="5" pathLength="100" stroke-dasharray="' + p + " " + (100 - p) + '" transform="rotate(-90 20 20)"/>' +
      '<text x="20" y="20" text-anchor="middle" dominant-baseline="central" font-size="' + fs + '" font-weight="700" fill="#fff">' + n + "</text></svg>";
  }
  function truckTip(t) { var s = byId(t.sector); return "Camión " + t.num + " · " + (t.loaded ? "cargado" : "vacío") + " · " + Math.round(t.speed * 3.6) + " km/h — " + (s ? s.name : ""); }
  function paintTruck(t) {
    var el = t.el;
    el.classList.toggle("is-loaded", t.loaded);
    el.classList.toggle("in-selected", t.sector === selectedId);
    t.svg.style.transform = "rotate(" + Math.round(t.heading) + "deg)";
  }
  function stopTrucks() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    trucks.forEach(function (t) { if (t.marker) t.marker.map = null; });
    Object.keys(clusters).forEach(function (k) { clusters[k].map = null; });
    trucks = []; clusters = {}; sectorStats = {};
  }
  function initTrucks() {
    stopTrucks();
    var n = 0;
    sectors.forEach(function (s) {
      sectorStats[s.id] = { n: 0, loaded: 0 };
      if (!hasPath(s) || !gReady || !google.maps.marker) return;
      for (var k = 0; k < (s.initialTrucks || 0); k++) {
        n++;
        var total = s._cum[s._cum.length - 1];
        var d = Math.random() * total, dir = Math.random() < 0.5 ? 1 : -1;
        var t = { num: (n < 10 ? "00" : n < 100 ? "0" : "") + n, sector: s.id, d: d, dir: dir, speed: (15 + Math.random() * 20) / 3.6, loaded: Math.random() < 0.5, shown: false };
        t.pos = pointAt(s, d);
        t.heading = bearing(t.pos, pointAt(s, d + dir * 10));
        var el = document.createElement("div");
        el.className = "truck-icon";
        el.innerHTML = '<div class="tk">' + truckSvg() + '<span class="tk-label">' + t.num + "</span></div>";
        t.el = el; t.svg = el.querySelector("svg");
        t.marker = new google.maps.marker.AdvancedMarkerElement({ position: ll(t.pos), content: el, zIndex: 50 });
        t.marker.title = truckTip(t);
        trucks.push(t);
      }
    });
    recount();
    applyZoom();
    refreshTraffic();
    tickTimer = setInterval(tick, 1000);
  }
  function neighbourAt(point, exceptId) {
    for (var i = 0; i < sectors.length; i++) {
      var o = sectors[i];
      if (o.id === exceptId || !hasPath(o)) continue;
      if (P.distM(point, o.path[0]) < JOIN_RADIUS_M) return { s: o, atStart: true };
      if (P.distM(point, o.path[o.path.length - 1]) < JOIN_RADIUS_M) return { s: o, atStart: false };
    }
    return null;
  }
  function tick() {
    trucks.forEach(function (t) {
      var s = byId(t.sector);
      if (!s) return;
      var total = s._cum[s._cum.length - 1], changed = false;
      t.d += t.dir * t.speed * SIM_SPEEDUP;
      if (t.d >= total || t.d <= 0) {
        var atEnd = t.d >= total;
        t.d = atEnd ? total : 0;
        var nb = Math.random() < 0.7 ? neighbourAt(atEnd ? s.path[s.path.length - 1] : s.path[0], s.id) : null;
        if (nb) { t.sector = nb.s.id; t.d = nb.atStart ? 0 : nb.s._cum[nb.s._cum.length - 1]; t.dir = nb.atStart ? 1 : -1; }
        else { t.dir = -t.dir; t.loaded = !t.loaded; }
        changed = true;
      }
      var p = pointAt(byId(t.sector), t.d);
      if (Math.abs(p[0] - t.pos[0]) + Math.abs(p[1] - t.pos[1]) > 2e-6) t.heading = bearing(t.pos, p);
      t.pos = p;
      t.marker.position = ll(p);
      if (changed) t.marker.title = truckTip(t);
    });
    recount();
    syncFleet(false);
    refreshTraffic();
  }
  function recount() {
    sectors.forEach(function (s) { var st = sectorStats[s.id] || (sectorStats[s.id] = { n: 0, loaded: 0 }); st.n = 0; st.loaded = 0; });
    trucks.forEach(function (t) { var st = sectorStats[t.sector]; if (st) { st.n++; if (t.loaded) st.loaded++; } });
  }
  function truckSize(z) { return z >= 17 ? 28 : z === 16 ? 21 : z === 15 ? 17 : z === 14 ? 14 : 12; }
  function clusterParams(z) {
    if (z >= 17) return null;
    if (z === 16) return { cell: 30, min: 3 };
    if (z === 15) return { cell: 34, min: 3 };
    if (z === 14) return { cell: 42, min: 3 };
    if (z === 13) return { cell: 54, min: 2 };
    if (z === 12) return { cell: 66, min: 2 };
    return { cell: 80, min: 2 };
  }
  // Coordenadas de mundo en píxeles (Web Mercator) para agrupar camiones cercanos en pantalla.
  function project(p, z) {
    var scale = 256 * Math.pow(2, z), s = Math.sin(p[0] * Math.PI / 180);
    s = Math.min(Math.max(s, -0.9999), 0.9999);
    return { x: (p[1] + 180) / 360 * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
  }
  function applyZoom() {
    if (!gReady) return;
    var z = Math.round(map.getZoom());
    $("mapWrap").classList.toggle("lod-detail", z >= 17);
    $("map").style.setProperty("--tk", truckSize(z) + "px");
    syncFleet(true);
  }
  function makeCluster() {
    var el = document.createElement("div");
    el.className = "fleet-badge";
    var m = new google.maps.marker.AdvancedMarkerElement({ content: el, zIndex: 60, gmpClickable: true });
    m._el = el; m._n = -1; m._l = -1; m._members = [];
    m.addEventListener("gmp-click", function () {
      var b = new google.maps.LatLngBounds();
      m._members.forEach(function (t) { b.extend(ll(t.pos)); });
      map.fitBounds(b, 80);
      google.maps.event.addListenerOnce(map, "idle", function () { if (map.getZoom() > 17) map.setZoom(17); });
    });
    return m;
  }
  function setCluster(m, n, loaded) {
    if (m._n === n && m._l === loaded) return;
    m._n = n; m._l = loaded;
    var size = n >= 100 ? "l" : n >= 10 ? "m" : "s";
    m._el.innerHTML = '<div class="fb fb-' + size + '">' + clusterSvg(n, loaded) + "</div>";
    m.title = fmtTrucks(n) + " (" + loaded + " cargados, " + (n - loaded) + " vacíos). Clic para acercar";
  }
  var trucksOn = true;
  function syncFleet(repaint) {
    if (!gReady) return;
    var z = Math.round(map.getZoom()), p = clusterParams(z), cells = {};
    trucks.forEach(function (t) {
      t.single = true;
      if (!p || t.sector === selectedId) return;
      var pt = project(t.pos, z), key = Math.floor(pt.x / p.cell) + ":" + Math.floor(pt.y / p.cell);
      (cells[key] || (cells[key] = [])).push(t);
    });
    var used = {}, anyCluster = false;
    Object.keys(cells).forEach(function (key) {
      var list = cells[key];
      if (list.length < p.min) return;
      var lat = 0, lng = 0, loaded = 0;
      list.forEach(function (t) { t.single = false; lat += t.pos[0]; lng += t.pos[1]; if (t.loaded) loaded++; });
      var m = clusters[key] || (clusters[key] = makeCluster());
      m._members = list;
      m.position = { lat: lat / list.length, lng: lng / list.length };
      setCluster(m, list.length, loaded);
      if (trucksOn && !m.map) m.map = map;
      if (!trucksOn && m.map) m.map = null;
      used[key] = true; anyCluster = true;
    });
    Object.keys(clusters).forEach(function (key) { if (!used[key]) { clusters[key].map = null; delete clusters[key]; } });
    trucks.forEach(function (t) {
      var want = t.single && trucksOn;
      if (want && !t.shown) { t.marker.map = map; t.shown = true; }
      else if (!want && t.shown) { t.marker.map = null; t.shown = false; }
      if (t.shown) { if (repaint) t.marker.zIndex = t.sector === selectedId ? 70 : 50; paintTruck(t); }
    });
    var wrap = $("mapWrap");
    wrap.classList.toggle("has-selection", selectedId != null);
    $("fleetLegend").classList.toggle("has-clusters", anyCluster);
  }
  function refreshTraffic() {
    var els = document.querySelectorAll("[data-traffic]");
    for (var i = 0; i < els.length; i++) els[i].textContent = fmtTrucks(truckCount(els[i].getAttribute("data-traffic")));
    $("truckTotal").textContent = fmtTrucks(trucks.length) + (siteSel.value === "all" ? " en todos los sitios" : " en el sitio");
    try {
      var snap = {};
      Object.keys(sectorStats).forEach(function (k) { snap[k] = sectorStats[k].n; });
      sessionStorage.setItem("propuesta_truck_counts", JSON.stringify(snap));
    } catch (e) { /* sin almacenamiento */ }
  }

  // Capas
  $("layersBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    var p = $("layersPanel"); p.hidden = !p.hidden;
    $("layersBtn").setAttribute("aria-expanded", p.hidden ? "false" : "true");
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".map-layers")) { $("layersPanel").hidden = true; $("layersBtn").setAttribute("aria-expanded", "false"); } });
  $("lyTrucks").addEventListener("change", function () {
    trucksOn = this.checked;
    $("mapWrap").classList.toggle("no-trucks", !trucksOn);
    syncFleet(true);
  });
  $("lyLabels").addEventListener("change", function () { buildLayers(); if (selectedId != null) select(selectedId, "keep"); });

  // ---------- Vista Tabla ----------
  var sort = { key: "name", dir: 1 }, page = 0;
  var TYPE = { road: "Camino", fixed_point: "Punto fijo" };
  function cmp(a, b) {
    var k = sort.key, x = a[k], y = b[k];
    if (k === "type") { x = TYPE[a.baseline_type] || a.baseline_type; y = TYPE[b.baseline_type] || b.baseline_type; }
    if (x == null) return 1; if (y == null) return -1;
    if (typeof x === "number" || typeof x === "boolean") return (x - y) * sort.dir;
    return String(x).localeCompare(String(y), "es", { numeric: true }) * sort.dir;
  }
  function renderTable() {
    var rows = sectors.slice().sort(cmp);
    var per = Number($("rowsSel").value);
    var pages = per ? Math.max(1, Math.ceil(rows.length / per)) : 1;
    if (page >= pages) page = pages - 1;
    var start = per ? page * per : 0, shown = per ? rows.slice(start, start + per) : rows;
    Array.prototype.forEach.call(document.querySelectorAll("#secTable th[data-sort]"), function (th) {
      var on = th.getAttribute("data-sort") === sort.key;
      th.classList.toggle("sorted", on);
      th.setAttribute("aria-sort", on ? (sort.dir > 0 ? "ascending" : "descending") : "none");
      var a = th.querySelector(".arr"); if (a) a.remove();
      if (on) th.insertAdjacentHTML("beforeend", '<span class="arr">' + (sort.dir > 0 ? "↑" : "↓") + "</span>");
    });
    $("tblBody").innerHTML = shown.length ? shown.map(function (s) {
      return "<tr><td><a class=\"nm\" href=\"sector.html?id=" + encodeURIComponent(s.id) + "\">" + esc(s.name) + "</a></td>" +
        "<td>" + esc(TYPE[s.baseline_type] || s.baseline_type || "—") + "</td><td>" + esc(s.site_name) + "</td>" +
        "<td>" + fmtDec(s.length) + "</td><td>" + fmtDec(s.width) + "</td><td>" + (s.hierarchy == null ? "—" : s.hierarchy) + "</td>" +
        "<td>" + fmtDec(s.goal) + "</td><td>" + (s.testing ? "Sí" : "No") + "</td>" +
        "<td>" + fmtStamp(s.created_at) + "</td><td>" + fmtStamp(s.updated_at) + "</td>" +
        '<td class="acts"><button type="button" class="icon-act" data-edit="' + esc(s.id) + '" aria-label="Editar ' + esc(s.name) + '" title="Editar">' + ICON_EDIT + "</button>" +
        '<button type="button" class="icon-act del" data-del="' + esc(s.id) + '" aria-label="Eliminar ' + esc(s.name) + '" title="Eliminar">' + ICON_DEL + "</button></td></tr>";
    }).join("") : '<tr><td class="tbl-empty" colspan="11">No hay sectores con este filtro.</td></tr>';
    $("pageInfo").textContent = rows.length ? (start + 1) + "–" + (start + shown.length) + " de " + rows.length : "0 de 0";
    $("prevPage").disabled = page <= 0;
    $("nextPage").disabled = page >= pages - 1;
  }
  document.querySelector("#secTable thead").addEventListener("click", function (e) {
    var th = e.target.closest("th[data-sort]");
    if (!th) return;
    var k = th.getAttribute("data-sort");
    sort = { key: k, dir: sort.key === k ? -sort.dir : 1 };
    renderTable();
  });
  $("tblBody").addEventListener("click", function (e) {
    var t = e.target.closest("[data-edit],[data-del]");
    if (!t) return;
    if (t.hasAttribute("data-edit")) editSector(t.getAttribute("data-edit")); else askDelete(t.getAttribute("data-del"));
  });
  $("rowsSel").addEventListener("change", function () { page = 0; renderTable(); });
  $("prevPage").addEventListener("click", function () { page--; renderTable(); });
  $("nextPage").addEventListener("click", function () { page++; renderTable(); });

  // ---------- Leyendas ----------
  Array.prototype.forEach.call(document.querySelectorAll("[data-truck-svg]"), function (el) { el.innerHTML = truckSvg(); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-cluster-svg]"), function (el) { el.innerHTML = clusterSvg(5, 3); });
  $("effLegend").innerHTML = "<strong>Eficiencia de supresión (%)</strong>" + EFFICIENCY_COLOR_RANGES.map(function (r) {
    return '<span><i style="background:' + r.color + '"></i>' + esc(r.label) + "</span>";
  }).join("");

  // ---------- Carga y refresco ----------
  function prepare(list) {
    return list.map(function (s) {
      s._cum = hasPath(s) ? P.cumulative(s.path) : [0];
      s.projection = (s.lastAvg != null && s.baseline != null) ? window.sectorForecast(s).summary : null;
      return s;
    });
  }
  function refresh(refit) {
    applyFilter();
    if (selectedId != null && !byId(selectedId)) { selectedId = null; if (info) info.close(); }
    buildList();
    renderEvents();
    if (view === "tabla") { page = 0; renderTable(); }
    if (gReady) {
      buildLayers();
      if (refit) fitAll();
      initTrucks();
      if (selectedId != null) select(selectedId, "keep");
    } else {
      sectors.forEach(function (s) { sectorStats[s.id] = { n: s.initialTrucks || 0, loaded: 0 }; });
      refreshTraffic();
    }
  }
  function reload() { all = prepare(window.STORE.list()); refresh(false); }

  all = prepare(window.STORE.list());
  setView(view);
  refresh(true);

  // Mensaje de vuelta desde el formulario (crear / editar)
  (function () {
    var msg = null;
    try { msg = sessionStorage.getItem("propuesta_flash"); sessionStorage.removeItem("propuesta_flash"); } catch (e) { /* nada */ }
    if (msg) window.toast(msg, true);
  })();

  window.loadGoogleMaps(function (err) {
    if (err) { $("mapMsg").textContent = err.message + " La lista y la tabla siguen disponibles."; return; }
    var site = window.STORE.site(siteSel.value) || window.STORE.site(3);
    map = new google.maps.Map($("map"), {
      center: { lat: (site && site.lat) || -22.855, lng: (site && site.lng) || -69.34 }, zoom: 14,
      mapId: "DEMO_MAP_ID", mapTypeId: "satellite", tilt: 0, clickableIcons: false,
      mapTypeControl: true, mapTypeControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM, mapTypeIds: ["roadmap", "satellite"] },
      fullscreenControl: true, fullscreenControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
      zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      streetViewControl: false, rotateControl: false, cameraControl: false, gestureHandling: "greedy"
    });
    info = new google.maps.InfoWindow({ maxWidth: 300 });
    info.addListener("closeclick", function () { selectedId = null; sectors.forEach(function (o) { var l = layers[o.id]; if (l) { l.line.setOptions(lineOpts(o, "base")); l.halo.setOptions(haloOpts("base")); } if (cards[o.id]) cards[o.id].classList.remove("active"); }); syncFleet(true); renderEvents(); });
    gReady = true;
    google.maps.event.addListenerOnce(map, "idle", function () { $("mapMsg").hidden = true; });
    map.addListener("zoom_changed", function () { applyZoom(); });
    buildLayers();
    fitAll();
    initTrucks();
    var m = location.hash.match(/^#s(\d+)$/);
    if (m && byId(m[1])) setTimeout(function () { select(Number(m[1]), "list"); }, 500);
  });
})();
