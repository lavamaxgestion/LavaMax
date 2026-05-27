/**
 * Normaliza valores que vienen de Google Sheets (fechas/horas como ISO o serial).
 */

import { fechaEnZonaISO } from "./fecha-co.js";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Extrae YYYY-MM-DD de Date, ISO string o valor de celda. */
export function toFechaISO(val) {
  if (val === undefined || val === null || val === "") return "";

  if (typeof val === "string") {
    const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const iso = fechaEnZonaISO(new Date(val));
    if (iso) return iso;
    return val;
  }

  if (typeof val === "number") {
    const iso = fechaEnZonaISO(new Date(val));
    if (iso) return iso;
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const iso = fechaEnZonaISO(val);
    if (iso) return iso;
  }

  return String(val);
}

/** Extrae HH:mm de hora de Sheets (incluye serial 1899-12-30). */
export function toHoraHHmm(val) {
  if (val === undefined || val === null || val === "") return "";

  if (typeof val === "string") {
    const hm = val.match(/^(\d{1,2}):(\d{2})/);
    if (hm && !val.includes("T")) return `${pad2(hm[1])}:${hm[2]}`;

    if (val.includes("T")) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      }
    }
    return val;
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return `${pad2(val.getHours())}:${pad2(val.getMinutes())}`;
  }

  return String(val);
}

export function normalizeSolicitudFromSheets(row) {
  if (!row || typeof row !== "object") return row;

  return {
    ...row,
    fecha_solicitud: toFechaISO(row.fecha_solicitud) || row.fecha_solicitud,
    fecha_entrega: toFechaISO(row.fecha_entrega),
    hora_entrega: toHoraHHmm(row.hora_entrega),
    cliente_telefono:
      row.cliente_telefono !== undefined && row.cliente_telefono !== null
        ? String(row.cliente_telefono)
        : "",
    monto_pagado:
      row.monto_pagado !== undefined && row.monto_pagado !== null
        ? String(row.monto_pagado)
        : "",
    fecha_pago: toFechaISO(row.fecha_pago),
  };
}

export function normalizeSolicitudesList(list) {
  return (list || []).map(normalizeSolicitudFromSheets);
}
