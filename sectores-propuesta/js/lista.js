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
  var ICON_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  function setOpen(card, open) {
    card.classList.toggle("open", open);
    var t = card.querySelector("[data-toggle]");
    if (t) { t.setAttribute("aria-expanded", String(open)); t.title = open ? "Ver resumen" : "Ver detalle"; }
  }
  var ICON_MORE = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
  function closeMenus(except) {
    Array.prototype.forEach.call(document.querySelectorAll(".more-menu"), function (m) {
      if (m === except) return;
      m.hidden = true;
      var b = m.parentNode.querySelector("[data-more]"); if (b) b.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", function (e) { if (!(e.target.closest && e.target.closest(".more-wrap"))) closeMenus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenus(); });
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
  // ---------- Vista compacta de la tarjeta: iconos con su valor (al pasar el mouse dice qué es) ----------
  var MI = {
    eff: '<path d="M12 14l4-4"/><path d="M3.3 19a9 9 0 1 1 17.4 0"/>',
    goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    dust: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
    iri: '<path d="M3 12h3l3-7 4 14 3-7h5"/>',
    traffic: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    proj: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>'
  };
  function mi(key, value, tip, cls) {
    return '<span class="mi' + (cls ? " " + cls : "") + '" tabindex="0" data-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MI[key] + "</svg>" + value + "</span>";
  }
  function iriState(v) { return v < 0.34 ? { k: "ok", t: "Bueno" } : v < 0.7 ? { k: "warn", t: "En deterioro" } : v < 1.4 ? { k: "bad", t: "Requiere mantenimiento" } : { k: "bad", t: "Crítico" }; }
  function compactHtml(s) {
    var es = effStatus(s), bs = baselineStatus(s), rk = riskFor(s), h = "";
    if (es) h += mi("eff", s.efficiency + "%", "Eficiencia de supresión: " + s.efficiency + "% · " + es.text, "c-" + es.key);
    if (s.goal != null) h += mi("goal", fmtGoal(s.goal) + "%", "Meta de supresión: " + fmtGoal(s.goal) + "%");
    if (s.lastAvg != null) h += mi("dust", fmtNum(s.lastAvg), "Promedio de polvo de la última medición: " + fmtNum(s.lastAvg) + " mg/m³ · " + fmtShortDate(s.lastAvgDate) + (bs ? " · " + bs.text : ""), bs ? "c-" + bs.key : "");
    if (s.iri != null) { var ir = iriState(s.iri); h += mi("iri", s.iri.toFixed(2), "Promedio de IRI de la última medición: " + s.iri.toFixed(2) + " (" + ir.t + ") · " + fmtShortDate(s.iriDate), "c-" + ir.k); }
    var n = truckCount(s.id);
    h += mi("traffic", String(n), "Tráfico actual: " + fmtTrucks(n));
    return '<div class="sc-icons">' + h + "</div>" +
      '<div class="sc-proj" tabindex="0" data-tip="Proyección de emisión de polvo de las próximas 12 horas: ' + esc(rk ? rk.level : "sin datos") + '"><span>Proyección de polvo · 12 h</span>' + projectionBadge(rk) + "</div>";
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
    html += '<div class="sc-row m"><span>Tráfico actual</span><span><b data-traffic="' + esc(s.id) + '">' + fmtTrucks(truckCount(s.id)) + '</b> </span></div>';
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
    if (view === "mapa") fitMapHeight();
    if (view === "tabla") renderTable();
    else if (map) { google.maps.event.trigger(map, "resize"); if (!selectedId) fitAll(); }
  }
  $("viewSwitch").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setView(b.getAttribute("data-view")); });

  // ---------- Eliminar ----------
  function askDelete(id) {
    var s = all.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!s) return;
    window.confirmDeleteByName(s.name).then(function (ok) {
      if (!ok) return;
      if (!window.STORE.remove(s.id)) { window.toast("No se pudo guardar el cambio en este navegador."); return; }
      reload();
      window.toastAction("Sector «" + s.name + "» eliminado.", "Deshacer", function () {
        window.STORE.restore(s.id); reload(); window.toast("Se restauró el sector «" + s.name + "».", true);
      }, 10000);
    });
  }

  // ---------- Lista de tarjetas ----------
  var listEl = $("sectorList");
  function buildList() {
    listEl.innerHTML = "";
    cards = {};
    $("sectorCount").textContent = sectors.length + (sectors.length === 1 ? " sector" : " sectores");
    $("showListCount").textContent = sectors.length;
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
          '<span class="more-wrap"><button type="button" class="icon-act" data-more aria-haspopup="menu" aria-expanded="false" aria-label="Más opciones de ' + esc(s.name) + '" title="Más opciones">' + ICON_MORE + "</button>" +
          '<span class="more-menu" role="menu" hidden><button type="button" role="menuitem" data-del="' + esc(s.id) + '">' + ICON_DEL + "Eliminar sector…</button></span></span>" +
          '<button type="button" class="icon-act sc-toggle" data-toggle aria-expanded="false" aria-label="Ver el detalle de ' + esc(s.name) + '" title="Ver detalle">' + ICON_CHEV + "</button></span></div>" +
        compactHtml(s) +
        '<div class="sc-more">' + metricsHtml(s) +
        '<div class="sc-row foot"><span>' + fmtLen(s.length) + '</span><span>' + (function (n) { return n + (n === 1 ? " evento" : " eventos"); })((s.events || []).length) + "</span></div></div>";
      b.addEventListener("click", function (ev) {
        var t = ev.target.closest && ev.target.closest("[data-go],[data-edit],[data-del]");
        if (t && t.hasAttribute("data-go")) { goToSector(t.getAttribute("data-go")); return; }
        if (t && t.hasAttribute("data-edit")) { editSector(t.getAttribute("data-edit")); return; }
        if (t && t.hasAttribute("data-del")) { closeMenus(); askDelete(t.getAttribute("data-del")); return; }
        var mo = ev.target.closest && ev.target.closest("[data-more]");
        if (mo) { var menu = mo.parentNode.querySelector(".more-menu"); closeMenus(menu); menu.hidden = !menu.hidden; mo.setAttribute("aria-expanded", String(!menu.hidden)); if (!menu.hidden) menu.querySelector("button").focus(); return; }
        var tg = ev.target.closest && ev.target.closest("[data-toggle]");
        if (tg) { setOpen(b, !b.classList.contains("open")); return; }
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
  if ($("alarmsBtn")) renderAlarms();   // botón retirado en v1.0.12 (se conserva el código por si se retoma)
  if ($("alarmsBtn")) $("alarmsBtn").addEventListener("click", function () {
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
  // Tarjeta del sector en el mapa: compacta (una fila por dato) para que entre completa sin desplazarse.
  function fmtDayMonth(iso) { return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" }); }
  function popupHtml(s) {
    var es = effStatus(s), bs = baselineStatus(s), rk = riskFor(s);
    function row(label, full, value) { return '<dt title="' + esc(full) + '">' + label + "</dt><dd>" + value + "</dd>"; }
    return '<div class="popup"><dl class="pp">' +
      row("Eficiencia", "Eficiencia de supresión", s.efficiency == null ? "—" : '<b class="' + (es ? "c-" + es.key : "") + '">' + s.efficiency + '%</b> <span class="mut">meta ' + fmtGoal(s.goal) + "%</span>") +
      (s.lastAvg == null ? "" : row("Polvo", "Promedio de polvo de la última medición", '<b class="' + (bs ? "c-" + bs.key : "") + '">' + fmtNum(s.lastAvg) + ' mg/m³</b> <span class="mut">· ' + fmtDayMonth(s.lastAvgDate) + "</span>")) +
      (s.iri == null ? "" : row("IRI", "Promedio de IRI de la última medición", "<b>" + s.iri.toFixed(2) + '</b> <span class="mut">· ' + fmtDayMonth(s.iriDate) + "</span>")) +
      row("Tráfico", "Tráfico actual", '<b data-traffic="' + esc(s.id) + '">' + fmtTrucks(truckCount(s.id)) + "</b>") +
      row("Proyección 12 h", window.DUST_PROJECTION.title, projectionBadge(rk)) +
      "</dl>" +
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
      if (cards[o.id]) { setOpen(cards[o.id], active); cards[o.id].classList.toggle("active", active); cards[o.id].querySelector(".sc-select").setAttribute("aria-pressed", active ? "true" : "false"); }
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

  // ---------- Tráfico actual (último dato del sector; sin camiones en el mapa) ----------
  function truckCount(id) { var s = byId(id); return s ? (s.initialTrucks || 0) : 0; }
  function fmtTrucks(n) { return n + (n === 1 ? " camión" : " camiones"); }
  function syncFleet() { /* sin flota en el mapa */ }

  // ---------- Tooltip de los iconos de las tarjetas ----------
  var ftip = document.createElement("div");
  ftip.className = "float-tip"; ftip.setAttribute("role", "tooltip"); ftip.hidden = true;
  document.body.appendChild(ftip);
  function showFtip(el) {
    ftip.textContent = el.getAttribute("data-tip"); ftip.hidden = false;
    var r = el.getBoundingClientRect(), w = ftip.offsetWidth, hgt = ftip.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var y = r.top - hgt - 8; if (y < 8) y = r.bottom + 8;
    ftip.style.left = x + "px"; ftip.style.top = y + "px";
  }
  function hideFtip() { ftip.hidden = true; }
  listEl.addEventListener("mouseover", function (e) { var t = e.target.closest && e.target.closest("[data-tip]"); if (t) showFtip(t); });
  listEl.addEventListener("mouseout", function (e) { var t = e.target.closest && e.target.closest("[data-tip]"); if (t && !t.contains(e.relatedTarget)) hideFtip(); });
  listEl.addEventListener("focusin", function (e) { var t = e.target.closest && e.target.closest("[data-tip]"); if (t) showFtip(t); });
  listEl.addEventListener("focusout", hideFtip);
  listEl.addEventListener("scroll", hideFtip);

  // ---------- Altura del mapa ----------
  // Al cargar debe verse, sin desplazar, la simbología de colores y el inicio del historial de eventos.
  function fitMapHeight() {
    var wrap = $("mapWrap"), legends = document.querySelector(".legends");
    if (!wrap || view !== "mapa") return;
    var top = wrap.getBoundingClientRect().top + window.scrollY;
    var peek = 130;   // encabezado del historial + primer evento
    var h = window.innerHeight - top - (legends ? legends.offsetHeight : 0) - 16 - 16 - peek;
    wrap.style.height = Math.max(340, Math.min(720, Math.round(h))) + "px";
  }
  window.addEventListener("resize", function () { clearTimeout(fitMapHeight._t); fitMapHeight._t = setTimeout(fitMapHeight, 120); });

  // ---------- Panel derecho colapsable ----------
  function setListOpen(open) {
    $("viewMap").querySelector(".layout").classList.toggle("list-off", !open);
    $("hideList").setAttribute("aria-expanded", String(open));
    setPref("panel", open ? "1" : "0");
    if (map) google.maps.event.trigger(map, "resize");
  }
  $("hideList").addEventListener("click", function () { setListOpen(false); $("showList").focus(); });
  $("showList").addEventListener("click", function () { setListOpen(true); $("hideList").focus(); });
  setListOpen(getPref("panel", "1") !== "0");

  // Capas
  $("layersBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    var p = $("layersPanel"); p.hidden = !p.hidden;
    $("layersBtn").setAttribute("aria-expanded", p.hidden ? "false" : "true");
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".map-layers")) { $("layersPanel").hidden = true; $("layersBtn").setAttribute("aria-expanded", "false"); } });
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
      if (selectedId != null) select(selectedId, "keep");
    }
  }
  function reload() { all = prepare(window.STORE.list()); refresh(false); }

  all = prepare(window.STORE.list());
  setView(view);
  refresh(true);
  fitMapHeight();

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
    info = new google.maps.InfoWindow({ maxWidth: 320 });
    function deselect() {
      selectedId = null;
      sectors.forEach(function (o) { var l = layers[o.id]; if (l) { l.line.setOptions(lineOpts(o, "base")); l.halo.setOptions(haloOpts("base")); } if (cards[o.id]) { cards[o.id].classList.remove("active"); setOpen(cards[o.id], false); } });
      renderEvents();
    }
    info.addListener("closeclick", deselect);
    // Clic en cualquier parte del mapa (fuera de un sector): cierra la ventana del sector
    map.addListener("click", function () { if (selectedId != null || info.isOpen) { info.close(); deselect(); } });
    gReady = true;
    google.maps.event.addListenerOnce(map, "idle", function () { $("mapMsg").hidden = true; });
    buildLayers();
    fitAll();
    if (/[?&]debug\b/.test(location.search)) window.__propuesta = { map: map, layers: layers, select: select };
    var m = location.hash.match(/^#s(\d+)$/);
    if (m && byId(m[1])) setTimeout(function () { select(Number(m[1]), "list"); }, 500);
  });
})();
