// Riesgo de generación de polvo (PREDICTIVO) - propuesta para el prototipo.
//
// Combina cinco variables en un índice de 0 a 100. Cada variable se convierte primero en un
// puntaje de 0 a 100 (100 = condición que más favorece la generación de polvo) y luego se pondera.
//
//   Variable                          Puntaje 0                 Puntaje 100              Peso
//   Polvo última medición / línea base   0.5× o menos           1.5× o más               30 %
//   Tráfico esperado (camiones/km)       0                      6/km o más (tráfico alto) 25 %
//   Humedad relativa                     60 % o más             10 % o menos             20 %
//   Probabilidad de lluvia               100 %                  0 %                      15 %
//   Índice UV                            3 o menos              11 o más                 10 %
//
// Los pesos y rangos son una propuesta inicial, no un estándar: hay que calibrarlos con el
// historial real (datos de polvo, Dispatch y Meteoblue) antes de usarlos para alertar.
// Para el cliente final el índice se muestra como "Proyección de emisión de polvo (próximas 12 horas)"
// con tres niveles estandarizados. Los cortes y colores reutilizan los del Riesgo de polvo del
// pronóstico de la plataforma (DustRiskService): verde hasta 50, naranja de 51 a 75, rojo desde 76.
//   Baja      0-50   (en la plataforma: muy bajo y bajo)
//   Moderada  51-75  (moderado)
//   Alta      76-100 (alto y muy alto)
(function () {
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  var WEIGHTS = { dust: 30, traffic: 25, humidity: 20, rain: 15, uv: 10 };
  var TRAFFIC_HIGH_PER_KM = 6; // mismo umbral que la regla de tráfico alto

  var LEVELS = [
    { max: 50, key: "low", name: "Baja", color: "#00E400", status: "ok" },
    { max: 75, key: "moderate", name: "Moderada", color: "#FF7E00", status: "warn" },
    { max: 100, key: "high", name: "Alta", color: "#FF0000", status: "alert" }
  ];

  // Textos para el cliente (mensajes breves y en lenguaje simple).
  window.DUST_PROJECTION = {
    title: "Proyección de emisión de polvo (próximas 12 horas)",
    alert: "Se presentan condiciones que aumentan el riesgo de emisión de polvo en las próximas 12 horas.",
    link: "Ver más detalles en la interfaz del sector",
    eventType: "Alerta de emisión de polvo"
  };

  function levelFor(score) {
    for (var i = 0; i < LEVELS.length; i++) if (score <= LEVELS[i].max) return LEVELS[i];
    return LEVELS[LEVELS.length - 1];
  }

  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

  // inputs: { density (camiones/km), dustRatio (polvo / línea base), rain (%), humidity (%), uv }
  window.dustRisk = function (inputs) {
    var f = [
      {
        key: "dust", label: "Polvo (última medición)",
        text: fmt1(inputs.dustRatio) + "× la línea base",
        score: clamp01((inputs.dustRatio - 0.5) / 1.0) * 100
      },
      {
        key: "traffic", label: "Tráfico esperado",
        text: fmt1(inputs.density) + " camiones/km",
        score: clamp01(inputs.density / TRAFFIC_HIGH_PER_KM) * 100
      },
      {
        key: "humidity", label: "Humedad",
        text: Math.round(inputs.humidity) + " %",
        score: clamp01((60 - inputs.humidity) / 50) * 100
      },
      {
        key: "rain", label: "Probabilidad de lluvia",
        text: Math.round(inputs.rain) + " %",
        score: clamp01((100 - inputs.rain) / 100) * 100
      },
      {
        key: "uv", label: "Índice UV",
        text: fmt1(inputs.uv),
        score: clamp01((inputs.uv - 3) / 8) * 100
      }
    ];
    var total = 0;
    f.forEach(function (x) {
      x.weight = WEIGHTS[x.key];
      x.points = x.score * x.weight / 100;
      total += x.points;
    });
    var score = Math.round(total);
    var lvl = levelFor(score);
    return {
      score: score, level: lvl.name, key: lvl.key, color: lvl.color, status: lvl.status,
      lv5: levelFor5(score), factors: f
    };
  };

  // ---------- Escala de 5 niveles (interfaz del sector) ----------
  // Niveles, rangos y colores del Riesgo de polvo de la plataforma (DustRiskService). El resumen agrupa estos
  // cinco niveles en tres: Baja (muy bajo y bajo), Moderada y Alta (alto y muy alto).
  var LEVELS5 = [
    { max: 25, key: "vl", name: "Muy bajo", min: 0, color: "#00E400", desc: "Polvo mínimo esperado. No se requiere acción." },
    { max: 50, key: "l", name: "Bajo", min: 26, color: "#FFFF00", desc: "Posible polvo en zonas de alto tránsito." },
    { max: 75, key: "m", name: "Moderado", min: 51, color: "#FF7E00", desc: "Probable polvo visible. Considerar riego." },
    { max: 90, key: "h", name: "Alto", min: 76, color: "#FF0000", desc: "Polvo frecuente. Se recomienda regar." },
    { max: 100, key: "vh", name: "Muy alto", min: 91, color: "#8F3F97", desc: "Polvo intenso. Regar con prioridad." }
  ];
  function levelFor5(score) {
    for (var i = 0; i < LEVELS5.length; i++) if (score <= LEVELS5[i].max) return LEVELS5[i];
    return LEVELS5[LEVELS5.length - 1];
  }
  window.DUST_LEVELS5 = LEVELS5;

  // ---------- Pronóstico por hora (SIMULADO; vendría de Meteoblue / estaciones ambientales) ----------
  // Actualizado a las 16:00: "Ahora" es la hora 0 y las ventanas son las 4 horas siguientes, las 4 que siguen y
  // las 4 últimas, hasta las 04:00. Solo se listan las variables que entran en el cálculo (humedad, lluvia y UV);
  // el escenario es seco, típico de Sierra Gorda.
  window.FORECAST = {
    updated: "16:00",
    source: "Meteoblue (simulado)",
    windows: [
      { key: "now", name: "Ahora", from: 0, to: 0 },
      { key: "w4", name: "Próximas 4 h", from: 1, to: 4 },
      { key: "w8", name: "Próximas 8 h", from: 5, to: 8 },
      { key: "w12", name: "Próximas 12 h", from: 9, to: 12 }
    ],
    hours: [
      { t: "16:00", rh: 14, rain: 0, uv: 9 },
      { t: "17:00", rh: 14, rain: 0, uv: 6 },
      { t: "18:00", rh: 15, rain: 0, uv: 3 },
      { t: "19:00", rh: 16, rain: 0, uv: 1 },
      { t: "20:00", rh: 17, rain: 0, uv: 0 },
      { t: "21:00", rh: 18, rain: 0, uv: 0 },
      { t: "22:00", rh: 19, rain: 0, uv: 0 },
      { t: "23:00", rh: 20, rain: 0, uv: 0 },
      { t: "00:00", rh: 21, rain: 0, uv: 0 },
      { t: "01:00", rh: 22, rain: 0, uv: 0 },
      { t: "02:00", rh: 23, rain: 0, uv: 0 },
      { t: "03:00", rh: 24, rain: 0, uv: 0 },
      { t: "04:00", rh: 24, rain: 0, uv: 0 }
    ]
  };

  // Tráfico esperado por hora (de 16:00 a 04:00) como proporción del tráfico esperado del sector (SIMULADO; vendría
  // de la planificación y del historial de Dispatch): "day" baja después del turno de día, "night" sube con el turno
  // de noche y "flat" se mantiene.
  var TRAFFIC_PROFILES = {
    day: [1.0, 1.0, 0.9, 0.7, 0.5, 0.4, 0.35, 0.3, 0.3, 0.3, 0.3, 0.3, 0.35],
    flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    night: [0.3, 0.35, 0.5, 0.8, 1.1, 1.4, 1.7, 1.8, 1.8, 1.8, 1.7, 1.7, 1.6]
  };

  // Proyección de un sector: riesgo hora por hora, el valor más alto de cada ventana y el resumen.
  // El resumen (el nivel que se muestra en la lista de sectores) es el valor más alto de las próximas 12 horas,
  // así coincide con lo que se ve en la interfaz del sector.
  window.sectorForecast = function (s) {
    var F = window.FORECAST;
    var ratio = s.lastAvg / s.baseline;
    var density = s.projectedDensity || 0;
    var profile = TRAFFIC_PROFILES[s.trafficProfile] || TRAFFIC_PROFILES.flat;
    var all = F.hours.map(function (h, i) {
      var res = window.dustRisk({ density: density * profile[i], dustRatio: ratio, rain: h.rain, humidity: h.rh, uv: h.uv });
      res.hour = h.t; res.index = i; res.wx = h;
      return res;
    });
    function peak(from, to) {
      var best = all[from];
      for (var i = from + 1; i <= to; i++) if (all[i].score > best.score) best = all[i];
      return best;
    }
    var out = { updated: F.updated, ratio: ratio, density: density, hours: all };
    F.windows.forEach(function (w) { out[w.key] = peak(w.from, w.to); });
    out.summary = [out.w4, out.w8, out.w12].reduce(function (a, b) { return b.score > a.score ? b : a; });
    return out;
  };
})();
