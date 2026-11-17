// Crear y editar un sector: mismos campos y modos de mapa que la plataforma (Trazado, Archivo KML, Dibujar, Subir KML).
// Los cambios se guardan solo en este navegador (store.js).
(function () {
  "use strict";
  window.mountShell();
  var P = window.PROTO;
  function $(id) { return document.getElementById(id); }

  var editId = new URLSearchParams(location.search).get("id");
  var S = editId ? window.STORE.get(editId) : null;
  if (editId && !S) { $("notFound").hidden = false; $("form").hidden = true; return; }

  $("site").innerHTML = '<option value="">Seleccione…</option>' + window.STORE.sites().map(function (s) {
    return '<option value="' + s.id + '">' + P.esc(s.name) + "</option>";
  }).join("");

  var original = S ? (S.path || []).slice() : [];   // trazado guardado (Archivo KML / Trazado del sector)
  var path = original.slice();                       // trazado actual (modificado)
  var kmlName = S ? S.kml_filename : null;

  if (S) {
    document.title = "Editar sector | ABC Dust · Propuesta";
    $("crumbName").textContent = "Editar sector";
    $("name").value = S.name;
    $("site").value = String(S.site_id);
    $("idDispatch").value = S.id_dispatch || "";
    $("btype").value = S.baseline_type || "road";
    $("baseline").value = S.baseline != null ? S.baseline : "";
    $("length").value = S.length != null ? S.length : "";
    $("width").value = S.width != null ? S.width : "";
    $("hierarchy").value = S.hierarchy != null ? S.hierarchy : "";
    $("goal").value = S.goal != null ? S.goal : "";
    $("testing").checked = !!S.testing;
  } else {
    document.title = "Agregar nuevo sector | ABC Dust · Propuesta";
    $("baseline").value = "0";
    $("hierarchy").value = "1";
    $("goal").value = "90";
    $("width").value = "40";
    var last = null;
    try { last = localStorage.getItem("propuesta_sectores_sitio"); } catch (e) { /* nada */ }
    $("site").value = last && last !== "all" ? last : "3";   // por defecto, el sitio elegido en la lista (o Mina Sierra Gorda)
  }

  // ---------- Modos del mapa ----------
  var mode = "outline";
  var HINTS = {
    outline: function () { return path.length > 1 ? "Trazado del sector tal como se guardará." : "No hay trazado modificado. Use el modo Dibujar para crear el trazado del segmento."; },
    kml: function () { return original.length > 1 ? "Archivo KML original: " + (kmlName || "sin nombre") + "." : "No hay archivo KML original disponible. Use el modo Dibujar para crear el trazado del segmento."; },
    draw: function () { return "Haga clic en el mapa para agregar puntos al trazado. Arrastre un punto para moverlo."; },
    upload: function () { return "Seleccione un archivo KML con el trazado del sector (LineString)."; }
  };
  function setMode(m) {
    mode = m;
    Array.prototype.forEach.call($("modes").children, function (b) { b.classList.toggle("on", b.getAttribute("data-m") === m); });
    $("drawTools").hidden = m !== "draw";
    $("uploadBox").hidden = m !== "upload";
    $("modeHint").textContent = HINTS[m]();
    paint();
  }
  $("modes").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setMode(b.getAttribute("data-m")); });

  // ---------- Mapa ----------
  var map = null, line = null, origLine = null;
  function ll(p) { return { lat: p[0], lng: p[1] }; }
  function syncFromLine() {
    if (!line) return;
    path = line.getPath().getArray().map(function (x) { return [+x.lat().toFixed(6), +x.lng().toFixed(6)]; });
    autoLength();
    $("modeHint").textContent = HINTS[mode]();
  }
  function autoLength() {
    if (path.length < 2) return;
    var m = 0;
    for (var i = 1; i < path.length; i++) m += P.distM(path[i - 1], path[i]);
    $("length").value = (Math.round(m * 100) / 100).toString();
  }
  function paint() {
    if (!map) return;
    if (line) line.setMap(null);
    if (origLine) origLine.setMap(null);
    var show = mode === "kml" ? original : path;
    if (mode === "kml") {
      origLine = new google.maps.Polyline({ path: original.map(ll), map: map, strokeOpacity: 0,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#ffd400", strokeWeight: 3, scale: 3 }, offset: "0", repeat: "13px" }] });
    } else {
      line = new google.maps.Polyline({ path: path.map(ll), map: map, strokeColor: "#0071BC", strokeWeight: 4, strokeOpacity: 1, editable: mode === "draw" });
      var gp = line.getPath();
      ["set_at", "insert_at", "remove_at"].forEach(function (ev) { gp.addListener(ev, syncFromLine); });
    }
    if (show.length > 1) {
      var b = new google.maps.LatLngBounds();
      show.forEach(function (p) { b.extend(ll(p)); });
      map.fitBounds(b, 50);
    } else {
      var site = window.STORE.site($("site").value);
      if (site && site.lat != null) { map.setCenter({ lat: site.lat, lng: site.lng }); map.setZoom(15); }
    }
  }
  $("site").addEventListener("change", function () { if (path.length < 2) paint(); });
  $("undoPt").addEventListener("click", function () { if (line && line.getPath().getLength()) line.getPath().pop(); });
  $("clearDraw").addEventListener("click", function () {
    if (!path.length) return;
    window.confirmDialog("¿Está seguro?", "Esto eliminará el dibujo actual y le permitirá crear uno nuevo. Esta acción no se puede deshacer.", "Borrar").then(function (ok) {
      if (!ok) return;
      path = [];
      paint();
      $("modeHint").textContent = HINTS[mode]();
    });
  });

  // ---------- Subir KML ----------
  $("kmlFile").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (!/\.kml$/i.test(f.name)) { window.toast("Por favor, seleccione un archivo KML válido"); return; }
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var x = new DOMParser().parseFromString(String(rd.result), "text/xml");
        var lines = Array.prototype.map.call(x.getElementsByTagName("coordinates"), function (c) {
          return c.textContent.trim().split(/\s+/).map(function (t) { var a = t.split(",").map(Number); return [+a[1].toFixed(6), +a[0].toFixed(6)]; })
            .filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); });
        }).filter(function (l) { return l.length > 1; });
        if (!lines.length) throw new Error("sin línea");
        path = lines.sort(function (a, b) { return b.length - a.length; })[0];
        original = path.slice();
        kmlName = f.name;
        $("kmlName").textContent = f.name + " · " + path.length + " puntos";
        autoLength();
        setMode("outline");
        window.toast("KML cargado: " + f.name, true);
      } catch (e) { window.toast("Por favor, seleccione un archivo KML válido"); }
    };
    rd.readAsText(f);
  });

  window.loadGoogleMaps(function (err) {
    if (err) { $("fmapMsg").textContent = err.message; return; }
    map = new google.maps.Map($("fmap"), {
      center: { lat: -22.855, lng: -69.34 }, zoom: 14, mapTypeId: "roadmap", clickableIcons: false, gestureHandling: "greedy",
      mapTypeControl: true, mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_LEFT, mapTypeIds: ["roadmap", "satellite"] },
      fullscreenControl: true, streetViewControl: false, cameraControl: false,
      zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM }
    });
    map.addListener("click", function (e) {
      if (mode !== "draw") return;
      path.push([+e.latLng.lat().toFixed(6), +e.latLng.lng().toFixed(6)]);
      if (line) line.getPath().push(e.latLng); else paint();
    });
    google.maps.event.addListenerOnce(map, "idle", function () { $("fmapMsg").hidden = true; });
    paint();
  });
  setMode("outline");

  // ---------- Guardar ----------
  function num(id) { var v = $(id).value.trim(); return v === "" ? null : Number(v); }
  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var errs = [];
    function need(fid, inputId, msg) {
      var f = $(fid), bad = !$(inputId).value.trim();
      f.classList.toggle("err", bad);
      var m = f.querySelector(".msg"); if (m) m.remove();
      if (bad) { f.insertAdjacentHTML("beforeend", '<small class="msg">' + msg + "</small>"); errs.push(msg); }
    }
    need("f-name", "name", "El nombre es requerido");
    need("f-site", "site", "El sitio es requerido");
    need("f-btype", "btype", "El tipo de línea base es requerido");
    need("f-baseline", "baseline", "La línea base es requerida");
    need("f-goal", "goal", "La meta de supresión es requerida");
    var g = num("goal");
    if (g != null && (g < 0 || g > 100)) errs.push("La meta de supresión debe estar entre 0 y 100");
    if (errs.length) {
      $("errSum").hidden = false;
      $("errSum").innerHTML = '<div class="alert warn" role="alert"><svg viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/></svg><div>' + errs.map(P.esc).join("<br>") + "</div></div>";
      return;
    }
    $("errSum").hidden = true;
    var data = {
      name: $("name").value.trim(), site_id: Number($("site").value), id_dispatch: $("idDispatch").value.trim() || null,
      baseline_type: $("btype").value, baseline: num("baseline"), length: num("length"), width: num("width"),
      hierarchy: num("hierarchy"), goal: g, testing: $("testing").checked, path: path, kml_filename: kmlName
    };
    var ok = S ? window.STORE.update(S.id, data) : !!window.STORE.create(data);
    if (!ok) { window.toast("No se pudo guardar en este navegador (almacenamiento bloqueado)."); return; }
    try { sessionStorage.setItem("propuesta_flash", S ? "Sector actualizado exitosamente" : "Sector creado exitosamente"); } catch (e2) { /* nada */ }
    location.href = "index.html";
  });
})();
