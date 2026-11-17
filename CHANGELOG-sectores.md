# Propuesta Sectores (ABC Dust)

Página: `sectores-propuesta/index.html` (tarjeta «Propuesta Sectores» en la página principal).
La versión publicada se ve en el botón «Propuesta vX.Y.Z» de la página; cada versión sube `APP_VERSION` en `sectores-propuesta/js/shell.js` y agrega una entrada aquí.

## v1.0.5 (17/11/2026)
- Tipografía igual a la de la plataforma (medida con DevTools en Stage): Inter con espaciado 0.01em; títulos de sección 16 px/600, textos, valores, tablas, botones y campos 14 px, y chips, fechas y notas 13 px. Etiquetas de los campos como en Stage (14 px escaladas).
- Panel «Todos los sectores» colapsable: se oculta con el botón de su encabezado y vuelve con «Mostrar sectores» sobre el mapa; se recuerda la preferencia.
- Se quitan los camiones simulados de Dispatch: marcadores, grupos, animación, leyenda y opción de capa. «Tráfico actual» queda como dato fijo del sector, sin «en vivo».
- La tarjeta del sector en el mapa usa la tipografía de la plataforma.

## v1.0.4 (17/11/2026)
- Corrige el tamaño de los puntos rojos y amarillos del historial de eventos y de las alarmas configuradas.

## v1.0.3 (17/11/2026)
- Historial de eventos con ejemplos: sin un sector elegido muestra los 8 eventos más recientes de los sectores visibles.
- Cada evento indica la alarma configurada que lo registró (polvo, IRI, tráfico alto o riesgo de emisión).
- Botón «Alarmas configuradas» con las reglas de cada alarma (de ejemplo, tomadas del prototipo del cliente) en la lista y en el detalle; columna nueva en la tabla y en el PDF.

## v1.0.2 (17/11/2026)
- Al elegir un sector solo se desplaza la lista lateral: la página ya no salta y el buscador queda a la vista.

## v1.0.1 (17/11/2026)
- Mapa de la vista principal más alto: la ventana del sector ya no se corta, y el título del sector va en la cabecera de la ventana.
- El aviso «Clic en un sector» pasa arriba a la izquierda para no tapar el selector Mapa / Satélite.
- La lista de sectores queda fija al desplazar la página y se desplaza sola hasta el sector elegido.
- Exportar PDF: incluye la imagen satelital del trazado del sector y los gráficos con su proporción real.

## v1.0.0 (17/11/2026)
- Primera versión publicada de la propuesta de Sectores.
- Vista por defecto con el diseño del cliente: mapa satelital de Google con los sectores coloreados por eficiencia de supresión, camiones de Dispatch (simulados) y tarjetas con eficiencia, polvo, IRI, tráfico en vivo y proyección de emisión de polvo.
- Selector de vista: «Mapa» (diseño del cliente) o «Tabla» (la vista actual de la plataforma).
- Buscador de sectores, filtro por sitio y botón Agregar en las dos vistas; Editar y Eliminar en cada sector.
- Formulario para crear y editar sectores igual al de la plataforma, con trazado dibujado en el mapa o subido como KML.
- Interfaz del sector con el diseño del cliente y las descargas de la plataforma: Exportar PDF, Descargar KML y Descargar SVG, PNG o CSV del gráfico.
- Sectores y sitios reales copiados de Stage; las métricas (eficiencia, polvo, IRI, camiones, proyección y eventos) son datos de prueba. Los cambios se guardan solo en el navegador de quien los hace.
