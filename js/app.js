import { getApiUrl, setApiConfig, isMockMode } from "./api.js";
import {
  getSession,
  clearSession,
  canAccessRoute,
  getDefaultRoute,
  applyNavForRole,
} from "./auth.js";
import { resetMockData } from "./mock-data.js";
import { mountLogin } from "./views/login.js";
import { renderOrdenes } from "./views/ordenes.js";
import { renderNuevaSolicitud } from "./views/nueva-solicitud.js";
import { renderEntregas } from "./views/entregas.js";
import { renderPagos } from "./views/pagos.js";
import {
  renderInventario,
  renderTarifas,
  renderUsuarios,
  renderReportes,
} from "./views/admin.js";

const ROUTES = {
  "/": { title: "Ordenes de solicitud", render: renderOrdenes },
  "/nueva": { title: "Nueva solicitud", render: renderNuevaSolicitud },
  "/entregas": { title: "Entregas del dia", render: renderEntregas },
  "/pagos": { title: "Estado de pagos", render: renderPagos },
  "/admin/inventario": { title: "Inventario", render: (c) => renderInventario(c) },
  "/admin/tarifas": { title: "Tarifas", render: (c) => renderTarifas(c) },
  "/admin/usuarios": { title: "Usuarios", render: (c) => renderUsuarios(c) },
  "/admin/reportes": { title: "Reportes financieros", render: (c) => renderReportes(c) },
};

const content = document.getElementById("content");
const pageTitle = document.getElementById("page-title");
const topbarActions = document.getElementById("topbar-actions");
const appShell = document.getElementById("app-shell");
const loginScreen = document.getElementById("login-screen");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const menuToggle = document.getElementById("menu-toggle");
const toast = document.getElementById("toast");
const dialogApi = document.getElementById("dialog-api");

function setSidebarOpen(open) {
  sidebar?.classList.toggle("open", open);
  document.body.classList.toggle("sidebar-open", open);
  if (sidebarBackdrop) {
    sidebarBackdrop.hidden = !open;
    sidebarBackdrop.setAttribute("aria-hidden", open ? "false" : "true");
  }
  menuToggle?.setAttribute("aria-expanded", open ? "true" : "false");
  menuToggle?.setAttribute("aria-label", open ? "Cerrar menu" : "Abrir menu");
}

window.showToast = (msg, type = "") => {
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.hidden = false;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
};

function getRoute() {
  const hash = location.hash.replace("#", "") || "/";
  return hash.split("?")[0];
}

function getHashParams() {
  const hash = location.hash.replace("#", "") || "/";
  const q = hash.indexOf("?");
  if (q < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(q + 1));
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
}

let navToken = 0;
let unmountLogin = null;

function showLogin() {
  if (unmountLogin) {
    unmountLogin();
    unmountLogin = null;
  }
  if (appShell) appShell.hidden = true;
  if (loginScreen) {
    loginScreen.hidden = false;
    unmountLogin = mountLogin(loginScreen, onLoginSuccess);
  }
}

function onLoginSuccess(session) {
  if (unmountLogin) {
    unmountLogin();
    unmountLogin = null;
  }
  if (loginScreen) {
    loginScreen.hidden = true;
    loginScreen.innerHTML = "";
  }
  if (appShell) appShell.hidden = false;
  applyNavForRole(session.rol);
  goTo(getDefaultRoute(session.rol));
}

function ensureAuthenticated() {
  const session = getSession();
  if (!session) {
    showLogin();
    return null;
  }
  if (appShell?.hidden) {
    if (loginScreen) loginScreen.hidden = true;
    appShell.hidden = false;
    applyNavForRole(session.rol);
  }
  return session;
}

async function navigate() {
  if (!content) return;

  const session = ensureAuthenticated();
  if (!session) return;

  const token = ++navToken;
  const route = getRoute();

  if (!canAccessRoute(route, session.rol)) {
    window.showToast("No tienes acceso a esta seccion", "error");
    goTo(getDefaultRoute(session.rol));
    return;
  }
  const def = ROUTES[route] || ROUTES["/"];
  const editId = route === "/nueva" ? getHashParams().get("id") : null;
  pageTitle.textContent = editId ? "Editar solicitud" : def.title;
  setActiveNav(route in ROUTES ? route : "/");
  topbarActions.innerHTML = "";
  content.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando...</div>`;

  try {
    await def.render(content, topbarActions);
    if (token !== navToken) return;
  } catch (err) {
    if (token !== navToken) return;
    console.error("Error al renderizar vista:", err);
    content.innerHTML = `
      <div class="card empty">
        <strong>No se pudo cargar esta vista</strong>
        <p>${escapeHtml(err.message || String(err))}</p>
        <p><button type="button" class="btn btn-primary" id="btn-retry-view">Reintentar</button></p>
      </div>`;
    document.getElementById("btn-retry-view")?.addEventListener("click", navigate);
  } finally {
    if (token === navToken) {
      setSidebarOpen(false);
      showMockBanner();
    }
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function goTo(route) {
  const target = route === "/" ? "#/" : `#${route}`;
  const currentRoute = getRoute();
  if (currentRoute === route || location.hash === target) {
    navigate();
  } else {
    location.hash = target;
  }
}

document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(link.dataset.route);
  });
});

window.addEventListener("hashchange", navigate);

menuToggle?.addEventListener("click", () => {
  setSidebarOpen(!sidebar?.classList.contains("open"));
});

sidebarBackdrop?.addEventListener("click", () => setSidebarOpen(false));

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sidebar?.classList.contains("open")) {
    setSidebarOpen(false);
  }
});

document.getElementById("btn-config-api")?.addEventListener("click", () => {
  document.getElementById("api-url").value = getApiUrl();
  document.getElementById("admin-key").value =
    localStorage.getItem("lavarent_admin_key") || "";
  dialogApi.showModal();
});

dialogApi.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => dialogApi.close());
});

document.getElementById("form-api")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const url = document.getElementById("api-url").value;
  const key = document.getElementById("admin-key").value;
  setApiConfig(url, key);
  dialogApi.close();
  window.showToast("Configuracion guardada", "success");
  navigate();
});

function showMockBanner() {
  document.getElementById("mock-badge-wrap")?.remove();
  const session = getSession();
  if (!isMockMode() || !topbarActions || session?.rol !== "admin") return;

  const wrap = document.createElement("div");
  wrap.id = "mock-badge-wrap";
  wrap.className = "mock-banner-wrap";
  wrap.innerHTML = `
    <span class="mock-badge" title="Datos en localStorage del navegador">Modo prueba</span>
    <button type="button" class="btn btn-ghost btn-sm" id="btn-reset-mock">Restablecer</button>
  `;
  topbarActions.prepend(wrap);
  document.getElementById("btn-reset-mock")?.addEventListener("click", () => {
    if (!confirm("Restablecer inventario, tarifas, usuarios y solicitudes de ejemplo?")) return;
    resetMockData();
    window.showToast("Datos de prueba restablecidos", "success");
    navigate();
  });
}

document.getElementById("btn-logout")?.addEventListener("click", () => {
  clearSession();
  location.hash = "";
  showLogin();
});

if (!getApiUrl()) {
  setTimeout(() => {
    if (!getSession()) return;
    window.showToast(
      "Modo prueba: datos locales. Configura API cuando tengas Google Sheets.",
      ""
    );
  }, 600);
}

if (getSession()) {
  if (appShell) appShell.hidden = false;
  applyNavForRole(getSession().rol);
  navigate();
} else {
  showLogin();
}
