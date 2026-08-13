/*
  maps-config.js
  ----------------------------------------------------------------
  Este archivo existe SOLO para mantener la API key separada de la
  lógica de la aplicación (buena práctica de organización).

  IMPORTANTE — esto NO oculta la key del navegador:
  Cualquier API key de Google Maps JavaScript usada en el cliente
  es visible en el código fuente y en la pestaña de Red (Network)
  del navegador, sin importar en qué archivo esté. Eso es una
  limitación del propio servicio, no de este código.

  La protección real se configura del lado de Google Cloud Console:
    1. Restringir la key por "HTTP referrers (websites)" al dominio
       donde se publique (ej. allanzuniga-dlg.github.io/*)
    2. Restringir la key para que solo pueda usar "Maps JavaScript API"
    3. Configurar alertas/límites de presupuesto y cuota

  Si este archivo se publica en un repositorio público, la key sigue
  siendo pública igualmente — la restricción por dominio es lo que
  evita que otros la usen desde sitios distintos al tuyo.
*/
const GOOGLE_MAPS_API_KEY = "AIzaSyCOCXyc3o_7USdD83AcY9ISCm0DACSTx8g";
