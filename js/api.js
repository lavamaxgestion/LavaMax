import { combineFechaHoraCO, fechaCivilParaDisplay } from "./fecha-co.js";
import { mockRequest } from "./mock-data.js";
import {
  normalizeSolicitudesList,
  normalizeSolicitudFromSheets,
} from "./sheets-normalize.js";

const STORAGE_KEY = "lavarent_api_url";
const ADMIN_KEY = "lavarent_admin_key";

export function getApiUrl() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

/** true cuando no hay URL de Google Sheets y se usan datos locales */
export function isMockMode() {
  return !getApiUrl();
}

export function setApiConfig(url, adminKey) {
  localStorage.setItem(STORAGE_KEY, url.trim());
  if (adminKey) {
    localStorage.setItem(ADMIN_KEY, adminKey);
  } else {
    localStorage.removeItem(ADMIN_KEY);
  }
}

function buildUrl(params = {}) {
  const base = getApiUrl();
  if (!base) {
    throw new Error("Configura la URL del API en el boton API del menu.");
  }
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  });
  const admin = localStorage.getItem(ADMIN_KEY);
  if (admin) {
    url.searchParams.set("adminKey", admin);
  }
  return url.toString();
}

const REQUEST_TIMEOUT_MS = 20000;

async function request(method, params = {}, body = null) {
  if (isMockMode()) {
    const data = await mockRequest(method, params, body);
    if (!data.ok) {
      throw new Error(data.error || "Error en datos de prueba");
    }
    return data;
  }

  const url = buildUrl({ ...params, _method: method });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const options = {
    method: "GET",
    mode: "cors",
    signal: controller.signal,
  };

  if (body && method !== "GET") {
    options.method = "POST";
    options.headers = { "Content-Type": "text/plain;charset=utf-8" };
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "La API no respondio a tiempo. Revisa la URL en Configuracion > API."
      );
    }
    throw new Error(
      "No se pudo conectar con la API. Usa un servidor local (no abras el HTML directamente) y verifica la URL."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw new Error(
      "Respuesta invalida del API. Verifica la URL del Web App de Google Apps Script."
    );
  }

  if (!data.ok) {
    throw new Error(data.error || "Error en la solicitud");
  }
  if (params.resource === "solicitudes" && data.data) {
    data.data = Array.isArray(data.data)
      ? normalizeSolicitudesList(data.data)
      : normalizeSolicitudFromSheets(data.data);
  }
  if (params.resource === "reportes" && data.data) {
    if (Array.isArray(data.data.detalle)) {
      data.data.detalle = normalizeSolicitudesList(data.data.detalle);
    }
    if (Array.isArray(data.data.detalle_canceladas)) {
      data.data.detalle_canceladas = normalizeSolicitudesList(
        data.data.detalle_canceladas
      );
    }
  }
  return data;
}

async function authRequest(pin) {
  if (isMockMode()) {
    return request("GET", { resource: "auth", pin });
  }

  const base = getApiUrl();
  if (!base) {
    throw new Error("Configura la URL del API en el boton API del menu.");
  }

  const url = new URL(base);
  url.searchParams.set("resource", "auth");
  url.searchParams.set("pin", pin);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La API no respondio a tiempo.");
    }
    throw new Error("No se pudo conectar con la API.");
  } finally {
    clearTimeout(timeoutId);
  }

  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw new Error("Respuesta invalida del API.");
  }

  if (!data.ok) {
    throw new Error(data.error || "PIN incorrecto");
  }
  return data;
}

export const api = {
  login: (pin) => authRequest(pin),
  getSolicitudes: (filters = {}) => {
    const params = { resource: "solicitudes" };
    if (filters.estado) params.estado = filters.estado;
    if (filters.fecha_tipo) params.fecha_tipo = filters.fecha_tipo;
    if (filters.desde) params.desde = filters.desde;
    if (filters.hasta) params.hasta = filters.hasta;
    if (filters.buscar) params.buscar = filters.buscar;
    return request("GET", params);
  },
  getSolicitudesStats: () =>
    request("GET", { resource: "solicitudes", stats: "1" }),
  createSolicitud: (payload) =>
    request("POST", { resource: "solicitudes" }, payload),
  updateSolicitud: (id, payload) =>
    request("POST", { resource: "solicitudes", id }, payload),

  getInventario: () => request("GET", { resource: "inventario" }),
  saveInventario: (payload) =>
    request("POST", { resource: "inventario" }, payload),
  deleteInventario: (id) =>
    request("POST", { resource: "inventario", action: "delete", id }),

  getTarifas: () => request("GET", { resource: "tarifas" }),
  saveTarifa: (payload) => request("POST", { resource: "tarifas" }, payload),
  deleteTarifa: (id) =>
    request("POST", { resource: "tarifas", action: "delete", id }),

  getUsuarios: () => request("GET", { resource: "usuarios" }),
  saveUsuario: (payload) => request("POST", { resource: "usuarios" }, payload),
  deleteUsuario: (id) =>
    request("POST", { resource: "usuarios", action: "delete", id }),

  getReportes: (desde, hasta) =>
    request("GET", { resource: "reportes", desde, hasta }),
};

export function sortByEntrega(items) {
  return [...items].sort((a, b) => {
    const da = new Date(`${toFechaSort(a.fecha_entrega)}T${toHoraSort(a.hora_entrega)}`);
    const db = new Date(`${toFechaSort(b.fecha_entrega)}T${toHoraSort(b.hora_entrega)}`);
    return da - db;
  });
}

function toFechaSort(f) {
  const s = String(f || "");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10) || "1970-01-01";
}

function toHoraSort(h) {
  const s = String(h || "");
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "00:00";
}

export { sortByRecogida, formatFechaHoraRecogida, formatDuracionAlquiler, isRecogidaVencida } from "./alquiler.js";

export function isUrgent(item) {
  const entrega = combineFechaHoraCO(
    item.fecha_entrega,
    item.hora_entrega || "23:59"
  );
  if (!entrega) return false;
  const diff = entrega - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

export function formatDate(iso) {
  if (!iso) return "-";
  const d = iso.includes("T")
    ? new Date(iso)
    : fechaCivilParaDisplay(iso) || new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatMoney(n) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}
