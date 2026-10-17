# Propuesta para Cumplimiento (ABC Dust · Riego)

Página: `cumplimiento-propuesta.html`

## v1.5.1 (16/10/2026)
- Ejemplos de riegos que recorren varios sectores en un solo recorrido (RG-9001 en BE-01 a BE-03, el más reciente de Botadero Este; RG-9002 en CN-02 y CN-03; RG-9003 en RS-01 a RS-03).
- Un riego multisector aparece en cada uno de sus sectores; marcarlo muestra todos sus sectores en el mapa, y sus volúmenes se reparten por sector en los totales de cada sector.
- Marcar o desmarcar un sector marca o desmarca el riego completo, por lo que también cambia el estado de los otros sectores de ese riego.

## v1.5.0 (16/10/2026)
- Nueva lógica de marcado: al aplicar el filtro, los riegos entran sin marcar y el mapa queda vacío con la indicación de marcar riegos o sectores.
- Lo marcado manda en todo: el mapa (sectores, mapa de calor, camiones y rutas), la tarjeta de cumplimiento, las tarjetas comparativas y las pestañas muestran solo los riegos marcados.
- Marcar un sector marca todos sus riegos y desmarcarlo los desmarca; si solo algunos están marcados, la casilla se ve a medias.
- La pestaña Sectores lista solo los sectores con riegos en el filtro, con sus totales y cuántos riegos tiene marcados.
- El zoom se ajusta a los sectores con riegos marcados.

## v1.4.6 (16/10/2026)
- Una tarjeta de sector contraída reduce su alto aunque las demás estén expandidas.
- Los botones de contraer y cerrar vuelven al estilo de la v1.4.4.

## v1.4.5 (16/10/2026)
- El botón para contraer las tarjetas de sector queda visible junto a la ×, sin quedar tapado por el porcentaje.

## v1.4.4 (16/10/2026)
- Las tarjetas comparativas de los sectores seleccionados se pueden contraer y expandir, además de cerrarse; contraídas muestran solo el sector y su porcentaje.

## v1.4.3 (16/10/2026)
- Al seleccionar o quitar sectores, el mapa ajusta el zoom para mostrar todos los sectores seleccionados; sin selección, vuelve a mostrar todos los sectores filtrados.

## v1.4.2 (16/10/2026)
- La tarjeta de cumplimiento sobre el mapa se puede contraer y expandir; contraída muestra solo el porcentaje y la cantidad de riegos.

## v1.4.1 (16/10/2026)
- Al ingresar al módulo, el panel se abre en la pestaña Riegos.

## v1.4.0 (16/10/2026)
- Botón Pantalla completa: oculta el header, el menú y el pie, y el contenido de cumplimiento ocupa toda la pantalla.
- En pantalla completa, el detalle del riego se abre en una ventana superpuesta al mapa, con todo su contenido y botón Cerrar.
- Botón Vista compacta para regresar al diseño normal, conservando filtros, selección y vista del mapa (la tecla Esc también regresa).

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
