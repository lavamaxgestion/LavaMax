import {
  api,
  formatMoney,
  sortByRecogida,
  formatFechaHoraRecogida,
  formatDuracionAlquiler,
  isRecogidaVencida,
} from "../api.js";
import {
  ESTADOS_PAGO,
  ESTADO_PAGO_DEFAULT,
  montoCobrado,
  saldoPendiente,
  pagoBadgeClass,
  normalizeSolicitudPago,
} from "../finanzas.js";
import { ESTADOS_GESTION, isOrdenEnRuta } from "../estados.js";

const ESTADOS_GESTION_EN_RUTA = ESTADOS_GESTION.filter(
  (e) => e !== "pendiente" && e !== "cancelada"
);

let pagoDialogBound = false;
let modalContext = null;

export async function renderPagos(container) {
  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando pagos...</div>`;

  try {
    const { data } = await api.getSolicitudes();
    const items = sortByRecogida(
      (data || [])
        .map(normalizeSolicitudPago)
        .filter((i) => isOrdenEnRuta(i)),
      { descendente: false }
    );
    renderPagosList(container, items);
  } catch (err) {
    container.innerHTML = `
      <div class="card empty">
        <strong>No se pudieron cargar los pagos</strong>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function renderPagosList(container, items) {
  setupPagoDialog();

  const cobradoTotal = items.reduce((s, i) => s + montoCobrado(i), 0);
  const porCobrar = items.reduce((s, i) => s + saldoPendiente(i), 0);
  const pendientes = items.filter(
    (i) => (i.estado_pago || ESTADO_PAGO_DEFAULT) === ESTADO_PAGO_DEFAULT
  ).length;
  const listosRecoger = items.filter((i) => isRecogidaVencida(i)).length;

  container.innerHTML = `
    <div class="stats-grid pagos-stats">
      <div class="stat">
        <div class="stat-label">Por cobrar</div>
        <div class="stat-value stat-value-por-cobrar" id="pagos-stat-por-cobrar">${formatMoney(porCobrar)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Cobrado (en ruta)</div>
        <div class="stat-value stat-value-ingresos" id="pagos-stat-cobrado">${formatMoney(cobradoTotal)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Pendientes de pago</div>
        <div class="stat-value" id="pagos-stat-pendientes">${pendientes}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Listos para recoger</div>
        <div class="stat-value" id="pagos-stat-recoger">${listosRecoger}</div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 0.35rem">Cobros en recogida</h2>
      <p class="hint" style="margin:0 0 1rem">
        Ordenado por recogida (la mas proxima primero). Pulsa Actualizar para cambiar gestion y pago con confirmacion.
      </p>
      <div class="filters">
        <label class="field">
          <span>Gestion</span>
          <select id="filter-gestion">
            <option value="">Todas en ruta</option>
            ${ESTADOS_GESTION.filter((e) => e === "confirmada" || e === "entregada")
              .map((e) => `<option value="${e}">${e}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Estado de pago</span>
          <select id="filter-pago">
            <option value="">Todos</option>
            ${ESTADOS_PAGO.map((e) => `<option value="${e}">${e}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Buscar</span>
          <input type="search" id="filter-pago-buscar" placeholder="Cliente, telefono o lavadora" />
        </label>
      </div>
      <div id="pagos-list"></div>
    </div>
  `;

  const listEl = document.getElementById("pagos-list");
  const filterGestion = document.getElementById("filter-gestion");
  const filterPago = document.getElementById("filter-pago");
  const filterBuscar = document.getElementById("filter-pago-buscar");

  function updateStats() {
    const cobrado = items.reduce((s, i) => s + montoCobrado(i), 0);
    const saldo = items.reduce((s, i) => s + saldoPendiente(i), 0);
    const pend = items.filter(
      (i) => (i.estado_pago || ESTADO_PAGO_DEFAULT) === ESTADO_PAGO_DEFAULT
    ).length;
    const recoger = items.filter((i) => isRecogidaVencida(i)).length;
    document.getElementById("pagos-stat-por-cobrar").textContent = formatMoney(saldo);
    document.getElementById("pagos-stat-cobrado").textContent = formatMoney(cobrado);
    document.getElementById("pagos-stat-pendientes").textContent = String(pend);
    document.getElementById("pagos-stat-recoger").textContent = String(recoger);
  }

  function renderItemSummary(item) {
    const cobrado = montoCobrado(item);
    const saldo = saldoPendiente(item);
    const ep = item.estado_pago || ESTADO_PAGO_DEFAULT;
    const eg = item.estado || "pendiente";
    const vencida = isRecogidaVencida(item);

    return {
      cobrado,
      saldo,
      ep,
      eg,
      vencida,
      html: `
        <strong>${escapeHtml(item.cliente_nombre)}</strong>
        <div class="pagos-sub">${escapeHtml(item.cliente_telefono || "")}</div>
        <div class="pagos-sub">${escapeHtml(item.lavadora_codigo || "-")} · ${formatDuracionAlquiler(item)}</div>
      `,
      badges: `
        <span class="badge badge-${eg}">${escapeHtml(eg)}</span>
        <span class="badge ${pagoBadgeClass(ep)}">${escapeHtml(ep)}</span>
        ${vencida ? '<span class="badge badge-urgente">Recoger ya</span>' : ""}
      `,
      money: `
        <div class="pagos-money-row"><span>Total</span><strong>${formatMoney(item.total)}</strong></div>
        <div class="pagos-money-row"><span>Cobrado</span><span>${formatMoney(cobrado)}</span></div>
        <div class="pagos-money-row ${saldo > 0 ? "pagos-saldo-pendiente" : ""}"><span>Saldo</span><strong>${formatMoney(saldo)}</strong></div>
      `,
    };
  }

  function paint() {
    let filtered = sortByRecogida([...items], { descendente: false });
    const eg = filterGestion.value;
    const ep = filterPago.value;
    const q = filterBuscar.value.trim().toLowerCase();

    if (eg) filtered = filtered.filter((i) => i.estado === eg);
    if (ep) filtered = filtered.filter((i) => (i.estado_pago || ESTADO_PAGO_DEFAULT) === ep);
    if (q) {
      filtered = filtered.filter(
        (i) =>
          (i.cliente_nombre || "").toLowerCase().includes(q) ||
          (i.cliente_telefono || "").includes(q) ||
          (i.lavadora_codigo || "").toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">No hay solicitudes en ruta con esos filtros.</div>`;
      updateStats();
      return;
    }

    const cardsHtml = filtered
      .map((item) => {
        const s = renderItemSummary(item);
        return `
        <article class="pagos-card ${s.vencida ? "pagos-card-listo" : ""}" data-id="${item.id}">
          <header class="pagos-card-header">
            <div>
              <div class="pagos-card-recogida">${formatFechaHoraRecogida(item)}</div>
              ${s.html}
            </div>
          </header>
          <div class="pagos-card-badges">${s.badges}</div>
          <div class="pagos-card-money">${s.money}</div>
          <footer class="pagos-card-footer">
            <button type="button" class="btn btn-primary btn-sm btn-actualizar-pago" data-id="${item.id}">
              Actualizar estados
            </button>
          </footer>
        </article>`;
      })
      .join("");

    const tableHtml = filtered
      .map((item) => {
        const s = renderItemSummary(item);
        return `
        <tr data-id="${item.id}" class="${s.vencida ? "pagos-row-listo" : ""}">
          <td data-label="Recogida">
            <strong>${formatFechaHoraRecogida(item)}</strong>
            ${s.vencida ? '<span class="badge badge-urgente">Recoger ya</span>' : ""}
          </td>
          <td data-label="Cliente">${s.html}</td>
          <td data-label="Lavadora">${escapeHtml(item.lavadora_codigo || "-")}</td>
          <td data-label="Alquiler">${formatDuracionAlquiler(item)}</td>
          <td data-label="Total">${formatMoney(item.total)}</td>
          <td data-label="Cobrado">${formatMoney(s.cobrado)}</td>
          <td data-label="Saldo" class="${s.saldo > 0 ? "pagos-saldo-pendiente" : ""}">${formatMoney(s.saldo)}</td>
          <td data-label="Gestion"><span class="badge badge-${s.eg}">${escapeHtml(s.eg)}</span></td>
          <td data-label="Pago"><span class="badge ${pagoBadgeClass(s.ep)}">${escapeHtml(s.ep)}</span></td>
          <td data-label="Accion" class="pagos-col-accion">
            <button type="button" class="btn btn-primary btn-sm btn-actualizar-pago" data-id="${item.id}">
              Actualizar
            </button>
          </td>
        </tr>`;
      })
      .join("");

    listEl.innerHTML = `
      <div class="pagos-cards">${cardsHtml}</div>
      <div class="table-wrap pagos-table-wrap">
        <table class="pagos-table">
          <thead>
            <tr>
              <th>Recogida</th>
              <th>Cliente</th>
              <th>Lavadora</th>
              <th>Alquiler</th>
              <th>Total</th>
              <th>Cobrado</th>
              <th>Saldo</th>
              <th>Gestion</th>
              <th>Pago</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${tableHtml}</tbody>
        </table>
      </div>
    `;

    updateStats();

    listEl.querySelectorAll(".btn-actualizar-pago").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = items.find((i) => i.id === btn.dataset.id);
        if (item) openPagoDialog(item);
      });
    });
  }

  async function guardarSolicitud(id, payload, item, mensaje) {
    try {
      await api.updateSolicitud(id, payload);
      Object.assign(item, payload);
      normalizeSolicitudPago(item);
      window.showToast?.(mensaje, "success");
      return true;
    } catch (err) {
      window.showToast?.(err.message, "error");
      return false;
    }
  }

  function openPagoDialog(item) {
    modalContext = {
      item,
      snapshot: {
        estado: item.estado,
        estado_pago: item.estado_pago || ESTADO_PAGO_DEFAULT,
        monto_pagado: item.monto_pagado ?? "",
      },
      onSaved: (payload) => {
        if (payload.estado === "recogida") {
          const idx = items.findIndex((i) => i.id === item.id);
          if (idx >= 0) items.splice(idx, 1);
        }
        paint();
      },
      guardar: guardarSolicitud,
    };
    fillPagoDialog(item);
    document.getElementById("dialog-pago-update")?.showModal();
  }

  filterGestion.addEventListener("change", paint);
  filterPago.addEventListener("change", paint);
  filterBuscar.addEventListener("input", paint);
  paint();
}

function setupPagoDialog() {
  if (pagoDialogBound) return;
  pagoDialogBound = true;

  const dialog = document.getElementById("dialog-pago-update");
  const form = document.getElementById("form-pago-update");
  const selGestion = document.getElementById("dialog-estado-gestion");
  const selPago = document.getElementById("dialog-estado-pago");
  const montoWrap = document.getElementById("dialog-monto-wrap");
  const montoInput = document.getElementById("dialog-monto-pagado");
  const cambiosEl = document.getElementById("dialog-pago-cambios");

  if (!dialog || !form) return;

  selGestion.innerHTML = ESTADOS_GESTION_EN_RUTA.map(
    (e) => `<option value="${e}">${e}</option>`
  ).join("");
  selPago.innerHTML = ESTADOS_PAGO.map((e) => `<option value="${e}">${e}</option>`).join("");

  function closeDialog() {
    dialog.close();
    modalContext = null;
  }

  dialog.querySelectorAll("[data-close-pago]").forEach((btn) => {
    btn.addEventListener("click", closeDialog);
  });

  function toggleMonto() {
    const esParcial = selPago.value === "pago parcial";
    montoWrap.classList.toggle("hidden", !esParcial);
    if (esParcial && !montoInput.value && modalContext?.item) {
      const total = Number(modalContext.item.total) || 0;
      const prev = Number(modalContext.snapshot.monto_pagado) || 0;
      montoInput.value = prev || Math.round(total / 2);
    }
    updateCambiosPreview();
  }

  function updateCambiosPreview() {
    if (!modalContext) return;
    const { snapshot } = modalContext;
    const lines = [];
    if (selGestion.value !== snapshot.estado) {
      lines.push(`Gestion: ${snapshot.estado} → ${selGestion.value}`);
    }
    if (selPago.value !== snapshot.estado_pago) {
      lines.push(`Pago: ${snapshot.estado_pago} → ${selPago.value}`);
    }
    if (selPago.value === "pago parcial") {
      lines.push(`Monto pagado: ${formatMoney(montoInput.value || 0)}`);
    }
    if (lines.length) {
      cambiosEl.hidden = false;
      cambiosEl.textContent = lines.join(" · ");
    } else {
      cambiosEl.hidden = true;
      cambiosEl.textContent = "";
    }
  }

  selPago.addEventListener("change", toggleMonto);
  selGestion.addEventListener("change", updateCambiosPreview);
  montoInput.addEventListener("input", updateCambiosPreview);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!modalContext) return;

    const { item, snapshot, onSaved, guardar } = modalContext;
    const nuevoGestion = selGestion.value;
    const nuevoPago = selPago.value;
    const payload = {};

    if (nuevoGestion !== snapshot.estado) payload.estado = nuevoGestion;
    if (nuevoPago !== snapshot.estado_pago) payload.estado_pago = nuevoPago;

    if (nuevoPago === "pago parcial") {
      const monto = Number(montoInput.value);
      if (!monto || monto < 0) {
        window.showToast?.("Indica el monto pagado", "error");
        return;
      }
      payload.monto_pagado = monto;
    } else if (nuevoPago !== snapshot.estado_pago || snapshot.estado_pago === "pago parcial") {
      payload.monto_pagado = "";
    }

    if (!Object.keys(payload).length) {
      window.showToast?.("No hay cambios que guardar", "");
      closeDialog();
      return;
    }

    let msg = "¿Confirmar los cambios en esta orden?";
    if (payload.estado === "recogida") {
      msg =
        "¿Confirmar que la lavadora fue recogida? La orden saldra de la lista de cobros en ruta.";
    } else if (
      payload.estado_pago &&
      payload.estado_pago !== ESTADO_PAGO_DEFAULT &&
      payload.estado_pago !== "pago parcial"
    ) {
      msg = `¿Confirmar registro de pago: ${payload.estado_pago}?`;
    }

    if (!confirm(msg)) return;

    const ok = await guardar(item.id, payload, item, "Cambios guardados");
    if (!ok) return;

    closeDialog();
    onSaved(payload);
  });
}

function fillPagoDialog(item) {
  const resumen = document.getElementById("dialog-pago-resumen");
  const selGestion = document.getElementById("dialog-estado-gestion");
  const selPago = document.getElementById("dialog-estado-pago");
  const montoWrap = document.getElementById("dialog-monto-wrap");
  const montoInput = document.getElementById("dialog-monto-pagado");
  const cambiosEl = document.getElementById("dialog-pago-cambios");

  const eg = item.estado || "pendiente";
  const ep = item.estado_pago || ESTADO_PAGO_DEFAULT;
  const saldo = saldoPendiente(item);

  resumen.innerHTML = `
    <p><strong>${escapeHtml(item.cliente_nombre)}</strong></p>
    <p class="pagos-sub">${escapeHtml(item.cliente_telefono || "")}</p>
    <p>Recogida: <strong>${formatFechaHoraRecogida(item)}</strong></p>
    <p>Lavadora: ${escapeHtml(item.lavadora_codigo || "-")} · ${formatDuracionAlquiler(item)}</p>
    <p>Total ${formatMoney(item.total)} · Saldo ${formatMoney(saldo)}</p>
  `;

  selGestion.value = eg;
  selPago.value = ep;
  montoInput.value = item.monto_pagado !== "" && item.monto_pagado != null ? item.monto_pagado : "";
  montoInput.max = Number(item.total) || 0;
  montoWrap.classList.toggle("hidden", ep !== "pago parcial");
  cambiosEl.hidden = true;
  cambiosEl.textContent = "";
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
