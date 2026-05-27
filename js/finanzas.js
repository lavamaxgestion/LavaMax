import { combineFechaHoraCO, fechaCivilParaDisplay, fechaEnZonaISO, fechaHoyISO } from "./fecha-co.js";
import { normalizeSolicitudAlquiler, isRecogidaVencida, getFechaHoraRecogida } from "./alquiler.js";
import { toFechaISO } from "./sheets-normalize.js";
import {
  isOrdenEnRuta,
  isOrdenEntregadaAlCliente,
  normalizarEstadoGestion,
} from "./estados.js";

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

/** Aun debe dinero tras la entrega (incluye recogida con pago parcial u otros dias). */
export function tieneSaldoPorCobrar(solicitud) {
  return (
    isOrdenVisibleEnPagos(solicitud) &&
    isOrdenEntregadaAlCliente(solicitud) &&
    saldoPendiente(solicitud) > 0
  );
}

/** Cuenta en la tarjeta Pendientes de pago: sin cobro o abono parcial con saldo. */
export function isOrdenPendienteDePago(solicitud) {
  if (!tieneSaldoPorCobrar(solicitud)) return false;
  const ep = normalizarEstadoPago(solicitud.estado_pago);
  return ep === ESTADO_PAGO_DEFAULT || ep === "pago parcial";
}

/** Alias: ya pagadas = cobro completo. */
export function isOrdenPagada(solicitud) {
  return isOrdenCobradaCompleta(solicitud);
}

export function toFechaPagoISO(solicitud) {
  return toFechaISO(solicitud?.fecha_pago);
}

export function getFechaRecogidaCivilISO(solicitud) {
  const d = getFechaHoraRecogida(solicitud);
  return d ? fechaEnZonaISO(d) : "";
}

/** Fecha en que se registro el cobro (columna fecha_pago o recogida como respaldo). */
export function getFechaCobroISO(solicitud) {
  const fp = toFechaPagoISO(solicitud);
  if (fp) return fp;
  if (!isOrdenCobradaCompleta(solicitud)) return "";
  return getFechaRecogidaCivilISO(solicitud);
}

export function isCobroRegistradoHoy(solicitud, hoy = fechaHoyISO()) {
  return getFechaCobroISO(solicitud) === hoy;
}

/** Cobro total saldado y registrado en el dia en curso. */
export function isOrdenPagadaHoy(solicitud, hoy = fechaHoyISO()) {
  return isOrdenCobradaCompleta(solicitud) && isCobroRegistradoHoy(solicitud, hoy);
}

/** Vista Pagos: saldo pendiente o cobro completo registrado hoy. */
export function isOrdenVisibleEnVistaPagos(solicitud, hoy = fechaHoyISO()) {
  return (
    isOrdenVisibleEnPagos(solicitud) &&
    (tieneSaldoPorCobrar(solicitud) || isOrdenPagadaHoy(solicitud, hoy))
  );
}

function esRegistroDeCobro(estadoPago) {
  return normalizarEstadoPago(estadoPago) !== ESTADO_PAGO_DEFAULT;
}

/** Al guardar un cobro, fija fecha_pago al dia en curso (o la limpia si vuelve a pendiente). */
export function enrichPayloadPago(payload, snapshot = {}, hoy = fechaHoyISO()) {
  const out = { ...payload };
  const cambioEstado =
    out.estado_pago !== undefined && out.estado_pago !== snapshot.estado_pago;
  const cambioMonto =
    out.monto_pagado !== undefined && out.monto_pagado !== snapshot.monto_pagado;

  if (!cambioEstado && !cambioMonto) return out;

  const epNuevo = cambioEstado ? out.estado_pago : snapshot.estado_pago;
  if (esRegistroDeCobro(epNuevo) || (cambioMonto && normalizarEstadoPago(epNuevo) === "pago parcial")) {
    out.fecha_pago = hoy;
  } else if (cambioEstado && normalizarEstadoPago(epNuevo) === ESTADO_PAGO_DEFAULT) {
    out.fecha_pago = "";
  }
  return out;
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
export function buildPagosStats(items, hoy = fechaHoyISO()) {
  const visibles = (items || []).filter((i) => isOrdenVisibleEnVistaPagos(i, hoy));
  const porCobrarItems = visibles.filter(tieneSaldoPorCobrar);
  const enRutaItems = visibles.filter(isOrdenEnRuta);
  const pagadasHoy = visibles.filter((i) => isOrdenPagadaHoy(i, hoy));

  let cobrado_hoy = 0;
  let cobrado_anteriores = 0;
  visibles.forEach((i) => {
    const m = montoCobrado(i);
    if (m <= 0) return;
    if (isCobroRegistradoHoy(i, hoy)) cobrado_hoy += m;
    else cobrado_anteriores += m;
  });

  return {
    por_cobrar: porCobrarItems.reduce((s, i) => s + saldoPendiente(i), 0),
    cobrado_hoy,
    cobrado_anteriores,
    cobrado_total: cobrado_hoy,
    pendientes_pago: porCobrarItems.filter(isOrdenPendienteDePago).length,
    count_por_cobrar: porCobrarItems.length,
    count_ya_pagadas: pagadasHoy.length,
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
  solicitud.fecha_pago = toFechaPagoISO(solicitud);
  return solicitud;
}
