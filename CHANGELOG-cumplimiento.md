# Propuesta para Cumplimiento (ABC Dust · Riego)

Página: `cumplimiento-propuesta.html`

## v1.3.0 (16/10/2026)
- El contenido queda centrado con márgenes laterales entre el menú y el borde, con filtros y mapa en tarjetas, como en el resto del sistema.
- Botón Filtrar: los cambios en los filtros se aplican solo al presionarlo, con aviso de cambios sin aplicar. Al entrar se aplica Más reciente automáticamente.
- Más reciente toma el último riego de cada sitio marcado, respetando jornada y calendarización.
- Últimos 10/20/30 toma los últimos N riegos de cada sitio marcado, respetando jornada y calendarización.
- El resumen de filtros muestra el desglose de riegos por sitio.

## v1.2.0 (16/10/2026)
- Se respeta el header del sistema (logo del cliente, botón para contraer el menú, idioma y logo de abcdust), el pie de página y el botón de asistente.
- La vista de detalle del riego se abre dentro del marco del sistema, con el header y el menú lateral.
- En el detalle, las instrucciones del supervisor y los comentarios del operador se muestran en una línea de tiempo con filtro Todos / Supervisor / Operador.
- Un riego puede tener varias instrucciones del supervisor y varios comentarios del operador.
- El desplegable de Riegos ya no muestra comentarios; se consultan en la pestaña Comentarios.
- Volver a cumplimiento regresa directo al mapa y conserva filtros, selección, pestaña y vista; las flechas entre riegos ya no llenan el historial.

## v1.1.0 (16/10/2026)
- Se agrega el menú lateral de ABC Dust, con Riego / Cumplimiento activo y opción de contraerlo.
- Las barras muestran el rótulo Aplicado / Programado.
- Sectores, Camiones y Riegos muestran un resumen y el detalle en un desplegable; todo inicia colapsado.
- Botones Expandir todo y Colapsar todo en cada pestaña con desplegables.
- Riegos: casillas para marcar uno o varios riegos; los cálculos, el mapa y las demás pestañas usan solo los marcados.
- Sectores: la casilla selecciona el sector y el clic en la fila despliega el detalle.
- Comentarios: instrucciones del supervisor por riego (supervisor y fecha de emisión) y comentarios del operador (fecha del riego y del comentario), con filtro por tipo y por supervisor.
- Se elimina el bloque general de instrucciones; cada riego muestra su instrucción junto al comentario del operador.

## v1.0.0 (16/10/2026)
- Mapa como vista principal, en 3D, con el mapa de calor de polvo post-riego activo por defecto.
- Filtros de periodo: más reciente, últimos 7 días, último mes, últimos 10/20/30 riegos y rango libre de fechas.
- Filtros de sitios (selección múltiple), jornada y calendarización; se mantiene el filtro de sectores de prueba.
- Selección de uno o varios sectores desde el mapa o la lista, cada uno con su color y tarjeta comparativa.
- Camiones en el mapa con placa; agua y aditivo programado frente a aplicado por sector, camión y riego.
- Registro manual de agua y aditivo aplicados (se mantiene la función actual de guardar).
- Vista de detalle por riego con reporte de flujo, capas del mapa y descargas KML y PDF.
- Se mantienen las instrucciones del supervisor y los comentarios del operador.
