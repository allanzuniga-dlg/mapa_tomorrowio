// Utilidades compartidas (adaptadas del prototipo del cliente; sin Leaflet: distancias con haversine).
window.PROTO = (function () {
  "use strict";

  // Paleta de eficiencia de supresión: la misma del mapa de calor de la plataforma
  // (EFFICIENCY_COLOR_RANGES en abcdust_react/src/constants.ts). Mínimo incluido, máximo excluido.
  var EFFICIENCY_COLOR_RANGES = [
    { min: 0, max: 60, color: "#bd0003", label: "<60" },
    { min: 60, max: 70, color: "#ff0000", label: "60-70" },
    { min: 70, max: 80, color: "#ff6c3e", label: "70-80" },
    { min: 80, max: 85, color: "#ffa372", label: "80-85" },
    { min: 85, max: 90, color: "#88D1F1", label: "85-90" },
    { min: 90, max: 95, color: "#3399FF", label: "90-95" },
    { min: 95, max: 97, color: "#027DFF", label: "95-97" },
    { min: 97, max: 100, color: "#0039A9", label: "97-100" }
  ];
  function efficiencyColor(e) {
    for (var i = 0; i < EFFICIENCY_COLOR_RANGES.length; i++) {
      var r = EFFICIENCY_COLOR_RANGES[i];
      if (e >= r.min && e < r.max) return r.color;
    }
    return EFFICIENCY_COLOR_RANGES[EFFICIENCY_COLOR_RANGES.length - 1].color;
  }

  // Bandas de IRI de la plataforma (abcdust_react/src/utils/iri.ts).
  var IRI_RANGES = [
    { max: 0.34, color: "#80da78", label: "< 0.34" },
    { max: 0.6999, color: "#ece665", label: "0.34 - 0.6999" },
    { max: 1.3999, color: "#df4a3f", label: "0.6999 - 1.3999" },
    { max: Infinity, color: "#8144e4", label: "> 1.3999" }
  ];
  function iriColor(v) {
    for (var i = 0; i < IRI_RANGES.length; i++) if (v <= IRI_RANGES[i].max) return IRI_RANGES[i].color;
    return IRI_RANGES[IRI_RANGES.length - 1].color;
  }

  // Estado del promedio de polvo frente a la línea base del sector (define el color del valor):
  //   menos de 90 % de la línea base         -> por debajo (verde)
  //   entre 90 % y 110 % de la línea base    -> se acerca (amarillo)
  //   más de 110 % de la línea base          -> supera significativamente (rojo)
  function baselineStatus(s) {
    if (s.baseline == null || s.lastAvg == null) return null;
    var ratio = s.lastAvg / s.baseline;
    if (ratio < 0.9) return { key: "ok", text: "Por debajo de la línea base" };
    if (ratio <= 1.1) return { key: "warn", text: "Se acerca a la línea base" };
    return { key: "bad", text: "Supera significativamente la línea base" };
  }

  // Distancia en metros entre dos puntos [lat, lng].
  function distM(a, b) {
    var R = 6371008.8, r = Math.PI / 180;
    var dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // dd/mm/aaaa, hh:mm:ss (como la fecha de "Mediciones hasta" de la plataforma)
  function fmtDateTime(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + ", " +
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  // dd/mm/aaaa hh:mm
  function fmtDateTimeShort(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // Distancias acumuladas (m) a lo largo de una línea [[lat, lng], ...] y punto a d metros del inicio.
  function cumulative(path) {
    var cum = [0];
    for (var i = 1; i < path.length; i++) {
      cum.push(cum[i - 1] + distM(path[i - 1], path[i]));
    }
    return cum;
  }
  function pointAtDistance(path, cum, d) {
    var total = cum[cum.length - 1], i = 1;
    d = Math.max(0, Math.min(total, d));
    while (i < cum.length - 1 && cum[i] < d) i++;
    var seg = cum[i] - cum[i - 1] || 1;
    var f = (d - cum[i - 1]) / seg;
    var a = path[i - 1], b = path[i];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  return {
    EFFICIENCY_COLOR_RANGES: EFFICIENCY_COLOR_RANGES,
    efficiencyColor: efficiencyColor,
    IRI_RANGES: IRI_RANGES,
    iriColor: iriColor,
    baselineStatus: baselineStatus,
    esc: esc,
    pad: pad,
    fmtDateTime: fmtDateTime,
    fmtDateTimeShort: fmtDateTimeShort,
    cumulative: cumulative,
    distM: distM,
    pointAtDistance: pointAtDistance
  };
})();
