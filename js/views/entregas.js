import {
  api,
  sortByEntrega,
  isUrgent,
  formatDate,
  formatMoney,
} from "../api.js";
import { normalizeSolicitudPago } from "../finanzas.js";
import { formatDuracionAlquiler } from "../alquiler.js";
import {
  ESTADOS_GESTION_ENTREGA,
  hoyISO,
  isEntregaDelDia,
} from "../estados.js";

let entregaDialogBound = false;
let entregaModalContext = null;

export async function renderEntregas(container, topbar) {
  topbar.innerHTML = "";

  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando entregas...</div>`;

  try {
    const { data } = await api.getSolicitudes();
    const hoy = hoyISO();
    const items = sortByEntrega(
      (data || []).map(normalizeSolicitudPago).filter((i) => isEntregaDelDia(i, hoy))
    );
    renderEntregasList(container, items, hoy);
  } catch (err) {
    container.innerHTML = `
      <div class="card empty">
        <strong>No se pudieron cargar las entregas</strong>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function renderEntregasList(container, items, hoy) {
  setupEntregaDialog();

  const pendientes = items.filter((i) => i.estado === "pendiente" || i.estado === "confirmada");
  const entregadas = items.filter((i) => i.estado === "entregada").length;

  container.innerHTML = `
    <div class="stats-grid entregas-stats">
      <div class="stat">
        <div class="stat-label">Entregas hoy</div>
        <div class="stat-value">${items.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Por entregar</div>
        <div class="stat-value">${pendientes.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Ya entregadas</div>
        <div class="stat-value stat-value-ingresos">${entregadas}</div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 0.35rem">Entregas del dia</h2>
      <p class="hint" style="margin:0 0 1rem">
        ${formatDate(hoy)} · Ordenadas de la hora mas proxima a la mas lejana. Pulsa Actualizar para cambiar el estado de gestion.
      </p>
      <label class="field entregas-buscar">
        <span>Buscar</span>
        <input type="search" id="entregas-buscar" placeholder="Cliente, telefono, direccion o lavadora" />
      </label>
      <div id="entregas-list"></div>
    </div>
  `;

  const listEl = document.getElementById("entregas-list");
  const filterBuscar = document.getElementById("entregas-buscar");

  function paint() {
    let filtered = sortByEntrega([...items]);
    const q = filterBuscar.value.trim().toLowerCase();

    if (q) {
      filtered = filtered.filter(
        (i) =>
          (i.cliente_nombre || "").toLowerCase().includes(q) ||
          (i.cliente_telefono || "").includes(q) ||
          (i.direccion || "").toLowerCase().includes(q) ||
          (i.lavadora_codigo || "").toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">No hay entregas programadas para hoy con ese criterio.</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((item) => {
        const urgent = isUrgent(item);
        const hora = item.hora_entrega || "--:--";
        const eg = item.estado || "pendiente";
        return `
        <article class="order-card entregas-card ${urgent ? "priority" : ""}" data-id="${item.id}">
          <div class="order-time">
            <div class="day">${formatDate(item.fecha_entrega)}</div>
            <div class="hour">${hora}</div>
          </div>
          <div class="order-card-body">
            <div class="order-card-header">
              <strong>${escapeHtml(item.cliente_nombre)}</strong>
              <span class="badge badge-${eg}">${escapeHtml(eg)}</span>
              ${urgent ? '<span class="badge badge-urgente">Pronto</span>' : ""}
            </div>
            <div class="order-meta">
              <div>Tel: <strong>${escapeHtml(item.cliente_telefono || "-")}</strong></div>
              ${renderDireccionEntrega(item.direccion)}
              <div>Lavadora: <strong>${escapeHtml(item.lavadora_codigo || "-")}</strong> · ${formatDuracionAlquiler(item)} · ${formatMoney(item.total)}</div>
            </div>
            ${item.notas ? `<div class="order-meta">Notas: ${escapeHtml(item.notas)}</div>` : ""}
          </div>
          <div class="order-card-actions">
            <button type="button" class="btn btn-primary btn-sm btn-actualizar-entrega" data-id="${item.id}">
              Actualizar gestion
            </button>
          </div>
        </article>`;
      })
      .join("");

    listEl.querySelectorAll(".btn-actualizar-entrega").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = items.find((i) => i.id === btn.dataset.id);
        if (item) openEntregaDialog(item, items, paint);
      });
    });
  }

  filterBuscar.addEventListener("input", paint);
  paint();
}

function setupEntregaDialog() {
  if (entregaDialogBound) return;
  entregaDialogBound = true;

  const dialog = document.getElementById("dialog-entrega-update");
  const form = document.getElementById("form-entrega-update");
  const sel = document.getElementById("dialog-entrega-estado");
  const direccionEl = document.getElementById("dialog-entrega-direccion");
  const cambiosEl = document.getElementById("dialog-entrega-cambios");

  if (!dialog || !form || !sel || !direccionEl) return;

  sel.innerHTML = ESTADOS_GESTION_ENTREGA.map(
    (e) => `<option value="${e}">${e}</option>`
  ).join("");

  function closeDialog() {
    dialog.close();
    entregaModalContext = null;
  }

  dialog.querySelectorAll("[data-close-entrega]").forEach((btn) => {
    btn.addEventListener("click", closeDialog);
  });

  function updateCambiosHint() {
    if (!entregaModalContext) return;
    const { snapshot } = entregaModalContext;
    const parts = [];
    const nuevaDireccion = direccionEl.value.trim();
    if (sel.value !== snapshot.estado) {
      parts.push(`Gestion: ${snapshot.estado} → ${sel.value}`);
    }
    if (nuevaDireccion !== snapshot.direccion) {
      parts.push("Direccion de entrega actualizada");
    }
    if (parts.length) {
      cambiosEl.hidden = false;
      cambiosEl.textContent = parts.join(" · ");
    } else {
      cambiosEl.hidden = true;
      cambiosEl.textContent = "";
    }
  }

  sel.addEventListener("change", updateCambiosHint);
  direccionEl.addEventListener("input", updateCambiosHint);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!entregaModalContext) return;

    const { item, snapshot, onSaved, guardar } = entregaModalContext;
    const nuevoEstado = sel.value;
    const nuevaDireccion = direccionEl.value.trim();

    const payload = {};
    if (nuevoEstado !== snapshot.estado) payload.estado = nuevoEstado;
    if (nuevaDireccion !== snapshot.direccion) payload.direccion = nuevaDireccion;

    if (!Object.keys(payload).length) {
      window.showToast?.("No hay cambios que guardar", "");
      closeDialog();
      return;
    }

    if (!nuevaDireccion) {
      window.showToast?.("Ingresa la direccion de entrega", "error");
      direccionEl.focus();
      return;
    }

    let msg = `¿Confirmar cambios en esta entrega?`;
    if (payload.estado === "entregada") {
      msg = "¿Confirmar que la lavadora fue entregada al cliente?";
    }

    if (!confirm(msg)) return;

    const ok = await guardar(item.id, payload, item);
    if (!ok) return;

    closeDialog();
    onSaved();
  });
}

function openEntregaDialog(item, items, repaint) {
  const direccion = (item.direccion || "").trim();
  entregaModalContext = {
    item,
    snapshot: { estado: item.estado || "pendiente", direccion },
    onSaved: repaint,
    guardar: guardarSolicitud,
  };

  const resumen = document.getElementById("dialog-entrega-resumen");
  const sel = document.getElementById("dialog-entrega-estado");
  const direccionEl = document.getElementById("dialog-entrega-direccion");
  const cambiosEl = document.getElementById("dialog-entrega-cambios");

  resumen.innerHTML = `
    <p><strong>${escapeHtml(item.cliente_nombre)}</strong></p>
    <p class="pagos-sub">${escapeHtml(item.cliente_telefono || "")}</p>
    <p>Entrega: <strong>${item.fecha_entrega} ${item.hora_entrega || ""}</strong></p>
    <p>Lavadora: ${escapeHtml(item.lavadora_codigo || "-")} · ${formatDuracionAlquiler(item)}</p>
  `;

  direccionEl.value = direccion;
  sel.value = item.estado || "pendiente";
  cambiosEl.hidden = true;
  cambiosEl.textContent = "";

  document.getElementById("dialog-entrega-update")?.showModal();
}

function renderDireccionEntrega(direccion) {
  const text = (direccion || "").trim();
  if (!text) {
    return `
      <div class="entregas-direccion entregas-direccion--missing">
        <span class="entregas-direccion-label">Direccion de entrega</span>
        <span class="entregas-direccion-text">Sin direccion registrada</span>
        <span class="entregas-direccion-hint">Agregala con Actualizar gestion.</span>
      </div>
    `;
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
  return `
    <div class="entregas-direccion">
      <span class="entregas-direccion-label">Direccion de entrega</span>
      <span class="entregas-direccion-text">${escapeHtml(text)}</span>
      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="entregas-maps-link">Abrir en Maps</a>
    </div>
  `;
}

async function guardarSolicitud(id, payload, item) {
  try {
    await api.updateSolicitud(id, payload);
    Object.assign(item, payload);
    window.showToast?.("Gestion actualizada", "success");
    return true;
  } catch (err) {
    window.showToast?.(err.message, "error");
    return false;
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
