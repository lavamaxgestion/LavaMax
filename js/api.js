const STORAGE_KEY = "lavarent_api_url";
const ADMIN_KEY = "lavarent_admin_key";

export function getApiUrl() {
  return localStorage.getItem(STORAGE_KEY) || "";
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
  return data;
}

export const api = {
  getSolicitudes: () => request("GET", { resource: "solicitudes" }),
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
    const da = new Date(a.fecha_entrega + "T" + (a.hora_entrega || "00:00"));
    const db = new Date(b.fecha_entrega + "T" + (b.hora_entrega || "00:00"));
    return da - db;
  });
}

export function isUrgent(item) {
  const entrega = new Date(
    item.fecha_entrega + "T" + (item.hora_entrega || "23:59")
  );
  const diff = entrega - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

export function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00");
  return d.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatMoney(n) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency: "USD",
  }).format(Number(n) || 0);
}
