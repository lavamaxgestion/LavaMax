import { combineFechaHoraCO, fechaCivilParaDisplay } from "./fecha-co.js";
import { normalizeSolicitudAlquiler, isRecogidaVencida } from "./alquiler.js";
import { isOrdenEnRuta, normalizarEstadoGestion } from "./estados.js";

export const ESTADOS_PAGO = [
  "pago pendiente",
  "pago efectivo",
  "pago transferencia",
  "pago parcial",
];

export const ESTADO_PAGO_DEFAULT = "pago pendiente";

const ESTADO_PAGO_ALIASES = {
  "": ESTADO_PAGO_DEFAULT,
  "pendiente de pago": ESTADO_PAGO_DEFAULT,
  pendiente: ESTADO_PAGO_DEFAULT,
  "pago pendiente": ESTADO_PAGO_DEFAULT,
  "pago efectivo": "pago efectivo",
  efectivo: "pago efectivo",
  "pago en efectivo": "pago efectivo",
  "pago transferencia": "pago transferencia",
  transferencia: "pago transferencia",
  "pago parcial": "pago parcial",
  parcial: "pago parcial",
};

export function normalizarEstadoPago(estadoPago) {
  if (estadoPago === undefined || estadoPago === null) return ESTADO_PAGO_DEFAULT;

  const raw = String(estadoPago)
    .replace(/\u00a0/g, " ")
    .trim();
  if (!raw) return ESTADO_PAGO_DEFAULT;

  const key = raw.toLowerCase().replace(/\s+/g, " ");
  if (ESTADO_PAGO_ALIASES[key]) return ESTADO_PAGO_ALIASES[key];

  if (key.includes("efectivo")) return "pago efectivo";
  if (key.includes("transfer")) return "pago transferencia";
  if (key.includes("parcial")) return "pago parcial";
  if (key.includes("pendiente")) return ESTADO_PAGO_DEFAULT;

  return ESTADO_PAGO.includes(key) ? key : ESTADO_PAGO_DEFAULT;
}

export function pagoBadgeClass(estadoPago) {
  return `badge-${normalizarEstadoPago(estadoPago).replace(/\s+/g, "-")}`;
}

/** En listados de ordenes: canceladas no muestran chip de pago. */
export function debeMostrarBadgePago(estadoGestion) {
  return estadoGestion !== "cancelada";
}

export function montoCobrado(solicitud) {
  const total = Number(solicitud.total) || 0;
  const ep = normalizarEstadoPago(solicitud.estado_pago);

  if (ep === "pago efectivo" || ep === "pago transferencia") return total;
  if (ep === "pago parcial") {
    const pagado = Number(solicitud.monto_pagado) || 0;
    return Math.min(Math.max(0, pagado), total);
  }
  return 0;
}

export function saldoPendiente(solicitud) {
  const total = Number(solicitud.total) || 0;
  return Math.max(0, total - montoCobrado(solicitud));
}

/** Cobro totalmente saldado (sin saldo pendiente). */
export function isOrdenCobradaCompleta(solicitud) {
  return isOrdenVisibleEnPagos(solicitud) && saldoPendiente(solicitud) === 0;
}

/** Aun debe dinero (incluye recogida con pago parcial u otros dias). */
export function tieneSaldoPorCobrar(solicitud) {
  return isOrdenVisibleEnPagos(solicitud) && saldoPendiente(solicitud) > 0;
}

/** Alias: ya pagadas = cobro completo. */
export function isOrdenPagada(solicitud) {
  return isOrdenCobradaCompleta(solicitud);
}

/** Reportes admin: cartera (por cobrar / pend. pago) solo si ya fue entregada. */
export function cuentaEnCarteraReporteAdmin(solicitud) {
  return normalizarEstadoGestion(solicitud.estado) === "entregada";
}

/** Visible en Pagos: en ruta o recogida (con o sin saldo). */
export function isOrdenVisibleEnPagos(solicitud) {
  const e = normalizarEstadoGestion(solicitud.estado);
  if (e === "cancelada" || e === "pendiente") return false;
  if (e === "confirmada" || e === "entregada" || e === "recogida") return true;
  return false;
}

/** Totales de las tarjetas superiores en la vista Pagos. */
export function buildPagosStats(items) {
  const visibles = (items || []).filter(isOrdenVisibleEnPagos);
  const porCobrarItems = visibles.filter(tieneSaldoPorCobrar);
  const enRutaItems = visibles.filter(isOrdenEnRuta);
  const recogidaItems = visibles.filter(
    (i) => normalizarEstadoGestion(i.estado) === "recogida"
  );

  const cobrado_en_ruta = enRutaItems.reduce((s, i) => s + montoCobrado(i), 0);
  const cobrado_recogidas = recogidaItems.reduce((s, i) => s + montoCobrado(i), 0);

  return {
    por_cobrar: porCobrarItems.reduce((s, i) => s + saldoPendiente(i), 0),
    cobrado_total: visibles.reduce((s, i) => s + montoCobrado(i), 0),
    cobrado_en_ruta,
    cobrado_recogidas,
    pendientes_pago: porCobrarItems.filter(
      (i) => normalizarEstadoPago(i.estado_pago) === ESTADO_PAGO_DEFAULT
    ).length,
    count_por_cobrar: porCobrarItems.length,
    count_ya_pagadas: visibles.filter(isOrdenCobradaCompleta).length,
    listos_recoger: enRutaItems.filter(isRecogidaVencida).length,
  };
}

export function buildReporteFinanciero(solicitudes, desde, hasta) {
  const d0 = desde ? combineFechaHoraCO(desde, "00:00") : new Date(0);
  const d1 = hasta ? combineFechaHoraCO(hasta, "23:59") : new Date();

  const filtered = solicitudes.filter((r) => {
    const fe = fechaCivilParaDisplay(r.fecha_entrega);
    if (!fe) return false;
    return fe >= d0 && fe <= d1;
  });

  let ingresos_cobrados = 0;
  let por_cobrar = 0;
  let entregadas = 0;
  let canceladas = 0;
  let pendientes_pago = 0;
  let pagos_efectivo = 0;
  let pagos_transferencia = 0;
  let pagos_parciales = 0;

  const detalle = filtered.filter((r) => r.estado !== "cancelada");
  const detalle_canceladas = filtered.filter((r) => r.estado === "cancelada");

  detalle.forEach((r) => {
    if (r.estado === "entregada") entregadas++;

    const ep = normalizarEstadoPago(r.estado_pago);
    const cobrado = montoCobrado(r);
    const saldo = saldoPendiente(r);

    ingresos_cobrados += cobrado;
    if (cuentaEnCarteraReporteAdmin(r)) {
      por_cobrar += saldo;
      if (ep === ESTADO_PAGO_DEFAULT) pendientes_pago++;
    }
    if (ep === "pago efectivo") pagos_efectivo++;
    if (ep === "pago transferencia") pagos_transferencia++;
    if (ep === "pago parcial") pagos_parciales++;
  });

  canceladas = detalle_canceladas.length;

  return {
    ingresos_cobrados,
    por_cobrar,
    ingresos: ingresos_cobrados,
    total_solicitudes: filtered.length,
    entregadas,
    canceladas,
    pendientes_pago,
    pagos_efectivo,
    pagos_transferencia,
    pagos_parciales,
    detalle,
    detalle_canceladas,
  };
}

export function normalizeSolicitudPago(solicitud) {
  normalizeSolicitudAlquiler(solicitud);
  solicitud.estado = normalizarEstadoGestion(solicitud.estado) || solicitud.estado;
  solicitud.estado_pago = normalizarEstadoPago(solicitud.estado_pago);
  if (solicitud.monto_pagado === undefined || solicitud.monto_pagado === null) {
    solicitud.monto_pagado = "";
  }
  return solicitud;
}
