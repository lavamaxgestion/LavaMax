/**
 * Normaliza valores que vienen de Google Sheets (fechas/horas como ISO o serial).
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Extrae YYYY-MM-DD de Date, ISO string o valor de celda. */
export function toFechaISO(val) {
  if (val === undefined || val === null || val === "") return "";

  if (typeof val === "string") {
    const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    return val;
  }

  if (typeof val === "number") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
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
    direccion:
      row.direccion !== undefined && row.direccion !== null
        ? String(row.direccion).trim()
        : "",
    monto_pagado:
      row.monto_pagado !== undefined && row.monto_pagado !== null
        ? String(row.monto_pagado)
        : "",
  };
}

export function normalizeSolicitudesList(list) {
  return (list || []).map(normalizeSolicitudFromSheets);
}
