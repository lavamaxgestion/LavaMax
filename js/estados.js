import { fechaHoyISO } from "./fecha-co.js";

/** Estados de gestion de la solicitud (entrega / recogida). */

export const ESTADOS_GESTION = [
  "pendiente",
  "confirmada",
  "entregada",
  "recogida",
  "cancelada",
];

export function normalizarEstadoGestion(estado) {
  return String(estado ?? "")
    .trim()
    .toLowerCase();
}

/** Activas: aun no cerradas ni canceladas. */
export function isOrdenActiva(solicitud) {
  const e = normalizarEstadoGestion(solicitud.estado);
  return e !== "cancelada" && e !== "recogida";
}

/** Aun no entregadas al cliente (pendiente o confirmada). */
export function isPorEntregar(solicitud) {
  const e = normalizarEstadoGestion(solicitud.estado);
  return e === "pendiente" || e === "confirmada";
}

/** En ruta o listas para cobro al recoger. */
export function isOrdenEnRuta(solicitud) {
  const e = normalizarEstadoGestion(solicitud.estado);
  return e === "confirmada" || e === "entregada";
}

/** Ya entregada al cliente (en uso o ya recogida). */
export function isOrdenEntregadaAlCliente(solicitud) {
  const e = normalizarEstadoGestion(solicitud.estado);
  return e === "entregada" || e === "recogida";
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
  return fechaHoyISO();
}

/** Solicitud con entrega programada para hoy (excluye cancelada y recogida). */
export function isEntregaDelDia(solicitud, hoy = hoyISO()) {
  return (
    solicitud.fecha_entrega === hoy &&
    solicitud.estado !== "cancelada" &&
    solicitud.estado !== "recogida"
  );
}
