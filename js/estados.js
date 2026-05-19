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

/** En modal de pagos: solo entregada → recogida. */
export function puedeCambiarGestionEnPagos(estadoActual) {
  return estadoActual === "entregada";
}

export function esTransicionRecogidaEnPagos(estadoDesde, estadoHacia) {
  return estadoDesde === "entregada" && estadoHacia === "recogida";
}

/** Estados editables en la vista de entregas del dia. */
export const ESTADOS_GESTION_ENTREGA = ["pendiente", "confirmada", "entregada"];

/** Estados editables en el modulo de ordenes (antes de entrega). */
export const ESTADOS_GESTION_ORDENES = ["pendiente", "confirmada", "cancelada"];

export function puedeEditarGestionEnOrdenes(estadoActual) {
  return estadoActual === "pendiente" || estadoActual === "confirmada";
}

/** Opciones del select en ordenes segun el estado actual. */
export function opcionesGestionOrdenes(estadoActual) {
  if (!puedeEditarGestionEnOrdenes(estadoActual)) {
    return [estadoActual];
  }
  return ESTADOS_GESTION_ORDENES;
}

export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Solicitud con entrega programada para hoy (excluye cancelada y recogida). */
export function isEntregaDelDia(solicitud, hoy = hoyISO()) {
  return (
    solicitud.fecha_entrega === hoy &&
    solicitud.estado !== "cancelada" &&
    solicitud.estado !== "recogida"
  );
}
