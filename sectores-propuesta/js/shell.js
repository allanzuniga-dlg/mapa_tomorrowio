// Marco de la plataforma (encabezado, menú lateral, pie y asistente) + versionado de la propuesta.
// VERSIONADO: cada cambio publicado sube APP_VERSION, agrega una entrada al inicio de CHANGELOG
// (también en CHANGELOG-sectores.md, en la raíz del repositorio) y cambia el ?v= de los .css y .js en los .html
// para que los navegadores no usen archivos viejos de la caché.
(function () {
  "use strict";

  var APP_VERSION = "1.0.9";
  var APP_DATE = "17/11/2026";
  var CHANGELOG = [
    { v: "1.0.9", date: "17/11/2026", items: [
      "Clic en cualquier parte del mapa (fuera de un sector) cierra la ventana del sector, sin tener que usar la «X».",
      "Mapa menos alto: su altura se ajusta a la pantalla para que, al cargar, se vean la simbología de colores y el inicio del historial de eventos.",
      "Tarjetas del panel derecho compactas: iconos con el valor de eficiencia, meta, promedio de polvo, IRI y tráfico, y el chip de la proyección; al pasar el mouse sobre el icono o el valor se indica qué es. La flecha de cada tarjeta (o seleccionar el sector) despliega el detalle completo."
    ] },
    { v: "1.0.8", date: "17/11/2026", items: [
      "Tamaño de letra corregido: todos los textos a 14 px como en Stage (antes había textos secundarios a 13 px en la vista Mapa y en el detalle). Solo los chips de estado quedan a 13 px y el rol del usuario a 12 px, igual que en Stage."
    ] },
    { v: "1.0.7", date: "17/11/2026", items: [
      "Espaciado de letra calculado en cada elemento, como en Stage (0.14 px en textos de 14 px y 0.16 px en los de 16 px)."
    ] },
    { v: "1.0.6", date: "17/11/2026", items: [
      "Ajustes de la v1.0.5: el botón «Mostrar sectores» ya no tapa el botón de capas; botones y campos con el mismo espaciado de letra de Stage; etiquetas de la tarjeta del mapa en peso normal."
    ] },
    { v: "1.0.5", date: "17/11/2026", items: [
      "Tipografía igual a la de la plataforma (medida con DevTools en Stage): Inter con espaciado 0.01em; títulos de sección 16 px/600, textos, valores, tablas, botones y campos 14 px, y chips, fechas y notas 13 px. Etiquetas de los campos como en Stage (14 px escaladas).",
      "Panel «Todos los sectores» colapsable: se oculta con el botón de su encabezado y vuelve con «Mostrar sectores» sobre el mapa; se recuerda la preferencia.",
      "Se quitan los camiones simulados de Dispatch: marcadores, grupos, animación, leyenda y opción de capa. «Tráfico actual» queda como dato fijo del sector, sin «en vivo».",
      "La tarjeta del sector en el mapa usa la tipografía de la plataforma."
    ] },
    { v: "1.0.4", date: "17/11/2026", items: [
      "Corrige el tamaño de los puntos rojos y amarillos del historial de eventos y de las alarmas configuradas."
    ] },
    { v: "1.0.3", date: "17/11/2026", items: [
      "Historial de eventos con ejemplos: sin un sector elegido muestra los 8 eventos más recientes de los sectores visibles.",
      "Cada evento indica la alarma configurada que lo registró (polvo, IRI, tráfico alto o riesgo de emisión).",
      "Botón «Alarmas configuradas» con las reglas de cada alarma (de ejemplo, tomadas del prototipo del cliente) en la lista y en el detalle; columna nueva en la tabla y en el PDF."
    ] },
    { v: "1.0.2", date: "17/11/2026", items: [
      "Al elegir un sector solo se desplaza la lista lateral: la página ya no salta y el buscador queda a la vista."
    ] },
    { v: "1.0.1", date: "17/11/2026", items: [
      "Mapa de la vista principal más alto: la ventana del sector ya no se corta, y el título del sector va en la cabecera de la ventana.",
      "El aviso «Clic en un sector» pasa arriba a la izquierda para no tapar el selector Mapa / Satélite.",
      "La lista de sectores queda fija al desplazar la página y se desplaza sola hasta el sector elegido.",
      "Exportar PDF: incluye la imagen satelital del trazado del sector y los gráficos con su proporción real."
    ] },
    { v: "1.0.0", date: "17/11/2026", items: [
      "Primera versión publicada de la propuesta de Sectores.",
      "Vista por defecto con el diseño del cliente: mapa satelital de Google con los sectores coloreados por eficiencia de supresión, camiones de Dispatch (simulados) y tarjetas con eficiencia, polvo, IRI, tráfico en vivo y proyección de emisión de polvo.",
      "Selector de vista: «Mapa» (diseño del cliente) o «Tabla» (la vista actual de la plataforma).",
      "Buscador de sectores, filtro por sitio y botón Agregar en las dos vistas; Editar y Eliminar en cada sector.",
      "Formulario para crear y editar sectores igual al de la plataforma, con trazado dibujado en el mapa o subido como KML.",
      "Interfaz del sector con el diseño del cliente y las descargas de la plataforma: Exportar PDF, Descargar KML y Descargar SVG, PNG o CSV del gráfico.",
      "Sectores y sitios reales copiados de Stage; las métricas (eficiencia, polvo, IRI, camiones, proyección y eventos) son datos de prueba. Los cambios se guardan solo en este navegador."
    ] }
  ];
  window.APP_VERSION = APP_VERSION;
  window.CHANGELOG = CHANGELOG;

  function svg(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }
  var NAV = [
    ["Panel", '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'],
    ["Módulo IoT", '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/>'],
    ["Estaciones ambientales", '<path d="M3 8h12a3 3 0 1 0-3-3M3 12h17a3 3 0 1 1-3 3M3 16h8"/>'],
    ["Monitoreo con camiones", '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'],
    ["Monitoreo con camionetas", '<path d="M3 15V9l2-3h10l4 4h2v5h-2M3 15h2"/><circle cx="7.5" cy="15.5" r="1.8"/><circle cx="16.5" cy="15.5" r="1.8"/><path d="M9.5 15.5h5"/>'],
    ["Cámaras", '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'],
    ["Estaciones meteorológicas", '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/><circle cx="12" cy="14" r="1.6"/>'],
    ["Sectores", '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>', "index.html"],
    ["Sitios", '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'],
    ["Camiones", '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'],
    ["Riego", '<path d="M7 16.5a4.5 4.5 0 0 0 9 0c0-3-4.5-7.5-4.5-7.5S7 13.5 7 16.5zM14 4.5s3 3 3 5"/>', null, true],
    ["Nivelación", '<path d="M12 3 2 8.5 12 14l10-5.5L12 3Z"/><path d="m2 13.5 10 5.5 10-5.5"/>', null, true],
    ["Reportes", '<path d="M6 3h8l4 4v14H6z"/><path d="m9 14 2 2 4-4"/>'],
    ["Configuración", '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>']
  ];

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // Monta el marco alrededor de <main class="page">.
  window.mountShell = function () {
    var page = document.querySelector("main.page");
    var header = document.createElement("header");
    header.className = "sys-header";
    header.innerHTML =
      '<button class="menu-btn" id="menuBtn" aria-label="Abrir menú">' + svg('<path d="M4 6h16M4 12h16M4 18h16"/>') + "</button>" +
      '<div class="sys-brand"><img src="img/abcdust.png" alt="ABC Dust"><button class="side-toggle" id="sideToggle" aria-label="Contraer menú" title="Contraer menú">' +
        svg('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>') + "</button></div>" +
      '<div class="sys-right">' +
        '<button class="btn-dark" type="button" title="Solo visual en la propuesta">' + svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>').replace('stroke="currentColor"', 'stroke="currentColor" width="16" height="16"') + "Modo oscuro</button>" +
        '<svg class="flag" viewBox="0 0 26 26" role="img" aria-label="Idioma: español"><rect width="26" height="26" fill="#c60b1e"/><rect y="7" width="26" height="12" fill="#ffc400"/></svg>' +
        '<img class="logo" src="img/abcdust.png" alt="ABC Dust">' +
      "</div>";

    var shell = document.createElement("div");
    shell.className = "shell";
    var side = document.createElement("nav");
    side.className = "sys-side";
    side.setAttribute("aria-label", "Menú principal");
    side.innerHTML = '<div class="sys-nav">' + NAV.map(function (n) {
      var active = n[0] === "Sectores";
      return '<a href="' + (n[2] || "#") + '"' + (active ? ' class="active" aria-current="page"' : ' data-off="1"') + ' title="' + esc(n[0]) + '">' + svg(n[1]) +
        '<span class="lbl">' + esc(n[0]) + "</span>" + (n[3] ? svg('<path d="m6 9 6 6 6-6"/>').replace("<svg ", '<svg class="chev" ') : "") + "</a>";
    }).join("") + "</div>" +
      '<div class="sys-user"><div class="avatar">' + svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/>').replace('fill="none"', 'fill="currentColor"') + "</div>" +
      '<div class="who"><b>Bienvenido, Eric</b><small>Super Admin -- ABC Dust</small></div></div>';

    var main = document.createElement("div");
    main.className = "sys-main";
    page.parentNode.insertBefore(header, page);
    page.parentNode.insertBefore(shell, page);
    shell.appendChild(side);
    shell.appendChild(main);
    main.appendChild(page);
    var foot = document.createElement("footer");
    foot.className = "sys-foot";
    foot.textContent = "© " + new Date().getFullYear() + " - ABC Dust";
    main.appendChild(foot);

    var assist = document.createElement("button");
    assist.className = "assist";
    assist.setAttribute("aria-label", "Abrir chat de ayuda");
    assist.innerHTML = svg('<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/>').replace("<svg ", '<svg width="20" height="20" ');
    document.body.appendChild(assist);

    // Diálogo del historial de versiones
    var dlg = document.createElement("div");
    dlg.className = "dlg-bg";
    dlg.id = "clDlg";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.innerHTML = '<div class="dlg wide"><h2>Historial de versiones</h2><p>Propuesta de Sectores. Cada versión publicada queda registrada aquí y como commit en el repositorio.</p>' +
      CHANGELOG.map(function (c) {
        return '<div class="cl"><h4>v' + c.v + " <span>" + c.date + (c.v === APP_VERSION ? " · publicada" : "") + "</span></h4><ul>" +
          c.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul></div>";
      }).join("") +
      '<div class="acts" style="margin-top:12px"><button class="btn btn-text" id="resetData" type="button">Restablecer datos de Stage</button>' +
      '<button class="btn btn-primary" type="button" data-close>Cerrar</button></div></div>';
    document.body.appendChild(dlg);

    // Botón de versión en la cabecera de la página (si la página tiene .page-head)
    var head = page.querySelector(".page-head");
    if (head) {
      var vb = document.createElement("button");
      vb.type = "button";
      vb.className = "version no-print";
      vb.title = "Ver historial de versiones";
      vb.innerHTML = "Propuesta <strong>v" + APP_VERSION + "</strong> · " + APP_DATE;
      vb.addEventListener("click", function () { dlg.classList.add("open"); });
      var home = document.createElement("a");
      home.className = "back-home no-print";
      home.href = "../index.html";
      home.textContent = "Inicio DLG Tools";
      var sp = head.querySelector(".spacer");
      head.insertBefore(home, sp || null);
      head.insertBefore(vb, sp || null);
    }
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.hasAttribute("data-close")) dlg.classList.remove("open"); });
    document.getElementById("resetData").addEventListener("click", function () {
      if (!window.STORE) return;
      window.STORE.reset();
      location.reload();
    });

    // Contraer / abrir menú
    try { if (localStorage.getItem("sidebarCollapsed") === "1") document.body.classList.add("side-min"); } catch (e) { /* sin almacenamiento */ }
    document.getElementById("sideToggle").addEventListener("click", function () {
      var min = document.body.classList.toggle("side-min");
      try { localStorage.setItem("sidebarCollapsed", min ? "1" : "0"); } catch (e) { /* nada */ }
      window.dispatchEvent(new Event("resize"));
    });
    document.getElementById("menuBtn").addEventListener("click", function (e) { e.stopPropagation(); document.body.classList.toggle("side-open"); });
    document.addEventListener("click", function (e) { if (!e.target.closest(".sys-side")) document.body.classList.remove("side-open"); });
    side.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-off]");
      if (a) { e.preventDefault(); window.toast("«" + a.title + "» no forma parte de esta propuesta."); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { dlg.classList.remove("open"); document.body.classList.remove("side-open"); } });
  };

  // Aviso breve (Snackbar)
  var toastTimer;
  window.toast = function (msg, ok) {
    var el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.toggle("ok", !!ok);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3800);
  };

  // Confirmación «¿Está seguro?» como en la plataforma. Devuelve una promesa.
  window.confirmDialog = function (title, text, okLabel) {
    return new Promise(function (resolve) {
      var bg = document.createElement("div");
      bg.className = "dlg-bg open";
      bg.setAttribute("role", "alertdialog");
      bg.setAttribute("aria-modal", "true");
      bg.innerHTML = '<div class="dlg"><h2>' + esc(title) + "</h2><p>" + esc(text) + '</p><div class="acts">' +
        '<button class="btn btn-outline" type="button" data-r="0">Cancelar</button><button class="btn btn-danger" type="button" data-r="1">' + esc(okLabel || "Eliminar") + "</button></div></div>";
      document.body.appendChild(bg);
      bg.querySelector('[data-r="0"]').focus();
      function done(v) { bg.remove(); document.removeEventListener("keydown", key); resolve(v); }
      function key(e) { if (e.key === "Escape") done(false); }
      document.addEventListener("keydown", key);
      bg.addEventListener("click", function (e) {
        if (e.target === bg) return done(false);
        var b = e.target.closest("[data-r]");
        if (b) done(b.getAttribute("data-r") === "1");
      });
    });
  };

  // Carga la API de Google Maps (clave en ../maps-config.js, compartida con el resto del repositorio).
  window.loadGoogleMaps = function (cb) {
    if (window.google && window.google.maps && window.google.maps.Map) { cb(); return; }
    if (typeof GOOGLE_MAPS_API_KEY === "undefined" || !GOOGLE_MAPS_API_KEY) { cb(new Error("Falta la API key de Google Maps (maps-config.js).")); return; }
    window.__gmapsReady = function () { cb(); };
    var s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GOOGLE_MAPS_API_KEY) +
      "&callback=__gmapsReady&loading=async&v=weekly&language=es&region=CL&libraries=marker,geometry";
    s.async = true;
    s.onerror = function () { cb(new Error("No se pudo cargar Google Maps.")); };
    document.head.appendChild(s);
  };
})();
