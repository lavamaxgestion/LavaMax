import { getFechaHoraRecogida } from "./alquiler.js";
import { toFechaISO } from "./sheets-normalize.js";

export function getFechaFiltroISO(item, fechaTipo = "entrega") {
  if (fechaTipo === "recogida") {
    const recogida = getFechaHoraRecogida(item);
    if (!recogida) return null;
    const y = recogida.getFullYear();
    const m = String(recogida.getMonth() + 1).padStart(2, "0");
    const d = String(recogida.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return toFechaISO(item.fecha_entrega) || null;
}

export function matchSolicitudFilters(item, filters = {}) {
  const { estado, fecha_tipo, desde, hasta, buscar } = filters;

  if (estado && item.estado !== estado) return false;

  if (desde || hasta) {
    const fecha = getFechaFiltroISO(item, fecha_tipo || "entrega");
    if (!fecha) return false;
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;
  }

  if (buscar) {
    const q = String(buscar).trim().toLowerCase();
    if (!q) return true;
    const nombre = (item.cliente_nombre || "").toLowerCase();
    const tel = String(item.cliente_telefono || "");
    if (!nombre.includes(q) && !tel.includes(q)) return false;
  }

  return true;
}

export function filterSolicitudes(items, filters = {}) {
  return items.filter((item) => matchSolicitudFilters(item, filters));
}

export function buildSolicitudesStats(items, hoy) {
  let pendientes = 0;
  let entregas_hoy = 0;
  let recogidas = 0;

  for (const item of items) {
    const estado = item.estado;
    if (estado !== "cancelada" && estado !== "recogida") pendientes++;
    if (estado === "recogida") recogidas++;
    if (
      toFechaISO(item.fecha_entrega) === hoy &&
      estado !== "cancelada" &&
      estado !== "recogida"
    ) {
      entregas_hoy++;
    }
  }

  return { pendientes, entregas_hoy, recogidas };
}
