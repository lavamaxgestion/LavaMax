import { normalizeSolicitudAlquiler } from "./alquiler.js";

export const ESTADOS_PAGO = [
  "pendiente de pago",
  "pago efectivo",
  "pago transferencia",
  "pago parcial",
];

export const ESTADO_PAGO_DEFAULT = "pendiente de pago";

export function pagoBadgeClass(estadoPago) {
  return `badge-${(estadoPago || ESTADO_PAGO_DEFAULT).replace(/\s+/g, "-")}`;
}

export function montoCobrado(solicitud) {
  const total = Number(solicitud.total) || 0;
  const ep = solicitud.estado_pago || ESTADO_PAGO_DEFAULT;

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

export function buildReporteFinanciero(solicitudes, desde, hasta) {
  const d0 = desde ? new Date(desde + "T00:00:00") : new Date(0);
  const d1 = hasta ? new Date(hasta + "T23:59:59") : new Date();

  const filtered = solicitudes.filter((r) => {
    const fe = new Date(r.fecha_entrega + "T12:00:00");
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

  filtered.forEach((r) => {
    if (r.estado === "entregada") entregadas++;
    if (r.estado === "cancelada") {
      canceladas++;
      return;
    }

    const ep = r.estado_pago || ESTADO_PAGO_DEFAULT;
    const cobrado = montoCobrado(r);
    const saldo = saldoPendiente(r);

    ingresos_cobrados += cobrado;
    por_cobrar += saldo;

    if (ep === ESTADO_PAGO_DEFAULT) pendientes_pago++;
    if (ep === "pago efectivo") pagos_efectivo++;
    if (ep === "pago transferencia") pagos_transferencia++;
    if (ep === "pago parcial") pagos_parciales++;
  });

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
    detalle: filtered,
  };
}

export function normalizeSolicitudPago(solicitud) {
  normalizeSolicitudAlquiler(solicitud);
  if (!solicitud.estado_pago) solicitud.estado_pago = ESTADO_PAGO_DEFAULT;
  if (solicitud.monto_pagado === undefined || solicitud.monto_pagado === null) {
    solicitud.monto_pagado = "";
  }
  return solicitud;
}
