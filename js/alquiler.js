/** Duracion del alquiler y fecha/hora de recogida (cobro al recoger). */

import { combineFechaHoraCO } from "./fecha-co.js";

export const HORAS_ALQUILER_DEFAULT = 24;

export function getHorasAlquiler(solicitud) {
  const horas = Number(solicitud.horas_alquiler);
  if (horas > 0) return horas;
  const dias = Number(solicitud.dias_alquiler) || 1;
  return dias * HORAS_ALQUILER_DEFAULT;
}

export function getFechaHoraRecogida(solicitud) {
  const fecha = solicitud.fecha_entrega;
  if (!fecha) return null;
  const inicio = combineFechaHoraCO(fecha, solicitud.hora_entrega || "00:00");
  if (!inicio) return null;
  return new Date(inicio.getTime() + getHorasAlquiler(solicitud) * 60 * 60 * 1000);
}

export function sortByRecogida(items, { descendente = true } = {}) {
  return [...items].sort((a, b) => {
    const ra = getFechaHoraRecogida(a)?.getTime() ?? 0;
    const rb = getFechaHoraRecogida(b)?.getTime() ?? 0;
    return descendente ? rb - ra : ra - rb;
  });
}

export function formatFechaHoraRecogida(solicitud) {
  const d = getFechaHoraRecogida(solicitud);
  if (!d) return "-";
  return d.toLocaleString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuracionAlquiler(solicitud) {
  const h = getHorasAlquiler(solicitud);
  if (h === 12) return "12 horas";
  if (h === 24) return "24 horas (1 dia)";
  if (h % 24 === 0) return `${h / 24} dia(s)`;
  return `${h} horas`;
}

export function isRecogidaVencida(solicitud) {
  const recogida = getFechaHoraRecogida(solicitud);
  return recogida ? recogida.getTime() <= Date.now() : false;
}

export function normalizeSolicitudAlquiler(solicitud) {
  if (!solicitud.horas_alquiler) {
    const dias = Number(solicitud.dias_alquiler) || 1;
    solicitud.horas_alquiler = dias * HORAS_ALQUILER_DEFAULT;
  }
  return solicitud;
}

export function horasFromTarifa(tarifa) {
  const h = Number(tarifa?.horas_duracion);
  return h === 12 || h === 24 ? h : HORAS_ALQUILER_DEFAULT;
}
