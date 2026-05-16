import { getApiUrl, setApiConfig, isMockMode } from "./api.js";
import { resetMockData } from "./mock-data.js";
import { renderOrdenes } from "./views/ordenes.js";
import { renderNuevaSolicitud } from "./views/nueva-solicitud.js";
import {
  renderInventario,
  renderTarifas,
  renderUsuarios,
  renderReportes,
} from "./views/admin.js";

const ROUTES = {
  "/": { title: "Ordenes de solicitud", render: renderOrdenes },
  "/nueva": { title: "Nueva solicitud", render: renderNuevaSolicitud },
  "/admin/inventario": { title: "Inventario", render: (c) => renderInventario(c) },
  "/admin/tarifas": { title: "Tarifas", render: (c) => renderTarifas(c) },
  "/admin/usuarios": { title: "Usuarios", render: (c) => renderUsuarios(c) },
  "/admin/reportes": { title: "Reportes financieros", render: (c) => renderReportes(c) },
};

const content = document.getElementById("content");
const pageTitle = document.getElementById("page-title");
const topbarActions = document.getElementById("topbar-actions");
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

function setActiveNav(route) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
}

let navToken = 0;

async function navigate() {
  if (!content) return;

  const token = ++navToken;
  const route = getRoute();
  const def = ROUTES[route] || ROUTES["/"];
  pageTitle.textContent = def.title;
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
  if (location.hash === target) {
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
  if (!isMockMode() || !topbarActions) return;

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

if (!getApiUrl()) {
  setTimeout(() => {
    window.showToast(
      "Modo prueba: datos locales. Configura API cuando tengas Google Sheets.",
      ""
    );
  }, 600);
}

navigate();
