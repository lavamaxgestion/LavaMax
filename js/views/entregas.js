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

function isPorEntregar(item) {
  const e = item.estado;
  return e === "pendiente" || e === "confirmada";
}

function isEntregadaHoy(item) {
  return item.estado === "entregada";
}

function setupViewTabs(container, panels, onChange) {
  const tabs = container.querySelectorAll(".report-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.tab;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      Object.entries(panels).forEach(([key, panel]) => {
        if (panel) panel.hidden = key !== id;
      });
      onChange(id);
    });
  });
}

function renderEntregasList(container, items, hoy) {
  setupEntregaDialog();

  const pendientes = items.filter(isPorEntregar);
  const entregadasList = items.filter(isEntregadaHoy);

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
        <div class="stat-value stat-value-ingresos">${entregadasList.length}</div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 0.35rem">Entregas del dia</h2>
      <p class="hint" style="margin:0 0 1rem">
        ${formatDate(hoy)} · Ordenadas de la hora mas proxima a la mas lejana.
      </p>
      <nav class="report-tabs" role="tablist" aria-label="Entregas de hoy">
        <button type="button" class="report-tab active" role="tab" aria-selected="true" data-tab="pendientes" id="entregas-tab-pendientes">
          Por entregar <span class="report-tab-count" id="entregas-count-pendientes">${pendientes.length}</span>
        </button>
        <button type="button" class="report-tab" role="tab" aria-selected="false" data-tab="entregadas" id="entregas-tab-entregadas">
          Entregadas <span class="report-tab-count" id="entregas-count-entregadas">${entregadasList.length}</span>
        </button>
      </nav>
      <div id="entregas-panel-pendientes" class="report-panel" role="tabpanel" aria-labelledby="entregas-tab-pendientes">
        <p class="hint report-rango-hint">Pendientes y confirmadas · Pulsa Actualizar para marcar entrega.</p>
        <label class="field entregas-buscar">
          <span>Buscar</span>
          <input type="search" id="entregas-buscar-pendientes" placeholder="Cliente, telefono o lavadora" />
        </label>
        <div id="entregas-list-pendientes"></div>
      </div>
      <div id="entregas-panel-entregadas" class="report-panel" role="tabpanel" aria-labelledby="entregas-tab-entregadas" hidden>
        <p class="hint report-rango-hint">Lavadoras ya entregadas al cliente hoy.</p>
        <label class="field entregas-buscar">
          <span>Buscar</span>
          <input type="search" id="entregas-buscar-entregadas" placeholder="Cliente, telefono o lavadora" />
        </label>
        <div id="entregas-list-entregadas"></div>
      </div>
    </div>
  `;

  const listPendientes = document.getElementById("entregas-list-pendientes");
  const listEntregadas = document.getElementById("entregas-list-entregadas");
  const buscarPendientes = document.getElementById("entregas-buscar-pendientes");
  const buscarEntregadas = document.getElementById("entregas-buscar-entregadas");
  const countPendientes = document.getElementById("entregas-count-pendientes");
  const countEntregadas = document.getElementById("entregas-count-entregadas");

  function updateTabCounts() {
    const nP = items.filter(isPorEntregar).length;
    const nE = items.filter(isEntregadaHoy).length;
    if (countPendientes) countPendientes.textContent = String(nP);
    if (countEntregadas) countEntregadas.textContent = String(nE);
  }

  function paintPanel(listEl, tabItems, q, emptyMsg) {
    let filtered = sortByEntrega([...tabItems]);
    if (q) {
      filtered = filtered.filter(
        (i) =>
          (i.cliente_nombre || "").toLowerCase().includes(q) ||
          (i.cliente_telefono || "").includes(q) ||
          (i.lavadora_codigo || "").toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">${emptyMsg}</div>`;
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
              <div>Direccion: <strong>${escapeHtml(item.direccion || "-")}</strong></div>
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
        if (item) openEntregaDialog(item, repaintAll);
      });
    });
  }

  function repaintAll() {
    updateTabCounts();
    paintPanel(
      listPendientes,
      items.filter(isPorEntregar),
      buscarPendientes.value.trim().toLowerCase(),
      "No hay entregas pendientes para hoy con ese criterio."
    );
    paintPanel(
      listEntregadas,
      items.filter(isEntregadaHoy),
      buscarEntregadas.value.trim().toLowerCase(),
      "No hay lavadoras entregadas hoy con ese criterio."
    );
  }

  setupViewTabs(container, {
    pendientes: document.getElementById("entregas-panel-pendientes"),
    entregadas: document.getElementById("entregas-panel-entregadas"),
  });

  buscarPendientes.addEventListener("input", repaintAll);
  buscarEntregadas.addEventListener("input", repaintAll);
  repaintAll();
}

function setupEntregaDialog() {
  if (entregaDialogBound) return;
  entregaDialogBound = true;

  const dialog = document.getElementById("dialog-entrega-update");
  const form = document.getElementById("form-entrega-update");
  const sel = document.getElementById("dialog-entrega-estado");
  const cambiosEl = document.getElementById("dialog-entrega-cambios");
  const submitBtn = document.getElementById("dialog-entrega-confirmar");
  const submitLabel = submitBtn?.textContent || "Confirmar cambios";

  if (!dialog || !form || !sel) return;

  function resetSubmitBtn() {
    if (!submitBtn) return;
    submitBtn.disabled = false;
    submitBtn.textContent = submitLabel;
  }

  function setSubmitLoading() {
    if (!submitBtn) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";
  }

  sel.innerHTML = ESTADOS_GESTION_ENTREGA.map(
    (e) => `<option value="${e}">${e}</option>`
  ).join("");

  function closeDialog() {
    dialog.close();
    entregaModalContext = null;
    resetSubmitBtn();
  }

  dialog.querySelectorAll("[data-close-entrega]").forEach((btn) => {
    btn.addEventListener("click", closeDialog);
  });

  sel.addEventListener("change", () => {
    if (!entregaModalContext) return;
    const { snapshot } = entregaModalContext;
    if (sel.value !== snapshot.estado) {
      cambiosEl.hidden = false;
      cambiosEl.textContent = `Gestion: ${snapshot.estado} → ${sel.value}`;
    } else {
      cambiosEl.hidden = true;
      cambiosEl.textContent = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!entregaModalContext || submitBtn?.disabled) return;

    const { item, snapshot, onSaved, guardar } = entregaModalContext;
    const nuevoEstado = sel.value;

    if (nuevoEstado === snapshot.estado) {
      window.showToast?.("No hay cambios que guardar", "");
      closeDialog();
      return;
    }

    let msg = `¿Confirmar cambio de gestion a "${nuevoEstado}"?`;
    if (nuevoEstado === "entregada") {
      msg = "¿Confirmar que la lavadora fue entregada al cliente?";
    }

    if (!confirm(msg)) return;

    setSubmitLoading();
    const ok = await guardar(item.id, { estado: nuevoEstado }, item);
    if (!ok) {
      resetSubmitBtn();
      return;
    }

    closeDialog();
    onSaved();
  });
}

function openEntregaDialog(item, onSaved) {
  entregaModalContext = {
    item,
    snapshot: { estado: item.estado || "pendiente" },
    onSaved,
    guardar: guardarSolicitud,
  };

  const resumen = document.getElementById("dialog-entrega-resumen");
  const sel = document.getElementById("dialog-entrega-estado");
  const cambiosEl = document.getElementById("dialog-entrega-cambios");

  resumen.innerHTML = `
    <p><strong>${escapeHtml(item.cliente_nombre)}</strong></p>
    <p class="pagos-sub">${escapeHtml(item.cliente_telefono || "")}</p>
    <p>Entrega: <strong>${item.fecha_entrega} ${item.hora_entrega || ""}</strong></p>
    <p>${escapeHtml(item.direccion || "")}</p>
    <p>Lavadora: ${escapeHtml(item.lavadora_codigo || "-")} · ${formatDuracionAlquiler(item)}</p>
  `;

  sel.value = item.estado || "pendiente";
  cambiosEl.hidden = true;
  cambiosEl.textContent = "";

  const submitBtn = document.getElementById("dialog-entrega-confirmar");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar cambios";
  }

  document.getElementById("dialog-entrega-update")?.showModal();
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
