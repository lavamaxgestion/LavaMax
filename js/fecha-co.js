/**
 * Fechas en calendario de Colombia (America/Bogota, UTC-5 sin horario de verano).
 * Evita usar toISOString() para "hoy", que devuelve UTC y desfasa el dia.
 */

export const TZ_COLOMBIA = "America/Bogota";
export const OFFSET_COLOMBIA = "-05:00";

/** Fecha de hoy en Colombia (YYYY-MM-DD). */
export function fechaHoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_COLOMBIA }).format(new Date());
}

/** Convierte un instante a YYYY-MM-DD en calendario colombiano. */
export function fechaEnZonaISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_COLOMBIA }).format(d);
}

/** Primer dia del mes actual en Colombia. */
export function inicioMesISO() {
  return `${fechaHoyISO().slice(0, 8)}01`;
}

/** Suma dias a una fecha civil YYYY-MM-DD. */
export function sumarDiasISO(isoDate, dias) {
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3] + dias, 12, 0, 0);
  return fechaEnZonaISO(new Date(utc));
}

/** Combina fecha civil y hora como hora local de Colombia. */
export function combineFechaHoraCO(fechaISO, horaHHmm = "00:00") {
  const f = String(fechaISO || "").match(/^(\d{4}-\d{2}-\d{2})/);
  if (!f) return null;
  const hm = String(horaHHmm || "00:00").match(/^(\d{1,2}):(\d{2})/);
  const h = hm ? String(hm[1]).padStart(2, "0") : "00";
  const min = hm ? hm[2] : "00";
  const d = new Date(`${f[1]}T${h}:${min}:00${OFFSET_COLOMBIA}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ancla una fecha civil para mostrarla sin corrimiento por UTC. */
export function fechaCivilParaDisplay(isoDate) {
  const m = String(isoDate).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}T12:00:00${OFFSET_COLOMBIA}`);
}
