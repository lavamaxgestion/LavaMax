/** Estados de gestion de la solicitud (entrega / recogida). */

export const ESTADOS_GESTION = [
  "pendiente",
  "confirmada",
  "entregada",
  "recogida",
  "cancelada",
];

/** Activas: aun no cerradas ni canceladas. */
export function isOrdenActiva(solicitud) {
  const e = solicitud.estado;
  return e !== "cancelada" && e !== "recogida";
}

/** En ruta o listas para cobro al recoger. */
export function isOrdenEnRuta(solicitud) {
  const e = solicitud.estado;
  return e === "confirmada" || e === "entregada";
}
