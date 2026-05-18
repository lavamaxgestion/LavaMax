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
import { isOrdenEnRuta } from "../estados.js";

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
  const cobradoTotal = items.reduce((s, i) => s + montoCobrado(i), 0);
  const porCobrar = items.reduce((s, i) => s + saldoPendiente(i), 0);
  const pendientes = items.filter(
    (i) => (i.estado_pago || ESTADO_PAGO_DEFAULT) === ESTADO_PAGO_DEFAULT
  ).length;
  const listosRecoger = items.filter((i) => isRecogidaVencida(i)).length;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Por cobrar</div>
        <div class="stat-value" id="pagos-stat-por-cobrar">${formatMoney(porCobrar)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Cobrado (en ruta)</div>
        <div class="stat-value" id="pagos-stat-cobrado">${formatMoney(cobradoTotal)}</div>
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
        Ordenado por fecha y hora de recogida (la mas proxima primero). El pago se registra al recoger la lavadora.
      </p>
      <div class="filters">
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

  function paint() {
    let filtered = sortByRecogida([...items], { descendente: false });
    const ep = filterPago.value;
    const q = filterBuscar.value.trim().toLowerCase();

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

    listEl.innerHTML = `
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
              <th>Estado pago</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map((item) => {
                const cobrado = montoCobrado(item);
                const saldo = saldoPendiente(item);
                const ep = item.estado_pago || ESTADO_PAGO_DEFAULT;
                const esParcial = ep === "pago parcial";
                const vencida = isRecogidaVencida(item);
                return `
                <tr data-id="${item.id}" class="${vencida ? "pagos-row-listo" : ""}">
                  <td>
                    <strong>${formatFechaHoraRecogida(item)}</strong>
                    ${vencida ? '<span class="badge badge-urgente">Recoger ya</span>' : ""}
                  </td>
                  <td>
                    <strong>${escapeHtml(item.cliente_nombre)}</strong>
                    <div class="pagos-sub">${escapeHtml(item.cliente_telefono || "")}</div>
                  </td>
                  <td>${escapeHtml(item.lavadora_codigo || "-")}</td>
                  <td>${formatDuracionAlquiler(item)}</td>
                  <td>${formatMoney(item.total)}</td>
                  <td>${formatMoney(cobrado)}</td>
                  <td class="${saldo > 0 ? "pagos-saldo-pendiente" : ""}">${formatMoney(saldo)}</td>
                  <td class="pagos-actions-cell">
                    <span class="badge ${pagoBadgeClass(ep)}">${escapeHtml(ep)}</span>
                    <select class="estado-pago-select" data-id="${item.id}" aria-label="Estado de pago">
                      ${ESTADOS_PAGO.map(
                        (e) =>
                          `<option value="${e}" ${e === ep ? "selected" : ""}>${e}</option>`
                      ).join("")}
                    </select>
                    <label class="pagos-monto-field ${esParcial ? "" : "hidden"}">
                      <span>Monto pagado</span>
                      <input
                        type="number"
                        class="monto-pagado-input"
                        data-id="${item.id}"
                        min="0"
                        max="${Number(item.total) || 0}"
                        step="1000"
                        value="${item.monto_pagado !== "" ? item.monto_pagado : ""}"
                        placeholder="0"
                      />
                    </label>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    updateStats();

    listEl.querySelectorAll(".estado-pago-select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const nuevoEstado = e.target.value;
        const payload = { estado_pago: nuevoEstado };

        if (nuevoEstado === "pago parcial" && !item.monto_pagado) {
          payload.monto_pagado = Math.round((Number(item.total) || 0) / 2);
        } else if (nuevoEstado !== "pago parcial") {
          payload.monto_pagado = "";
        }

        await guardarPago(id, payload, item);
        paint();
      });
    });

    listEl.querySelectorAll(".monto-pagado-input").forEach((inp) => {
      inp.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const item = items.find((i) => i.id === id);
        if (!item) return;
        await guardarPago(
          id,
          { monto_pagado: e.target.value, estado_pago: "pago parcial" },
          item
        );
        paint();
      });
    });
  }

  async function guardarPago(id, payload, item) {
    try {
      await api.updateSolicitud(id, payload);
      Object.assign(item, payload);
      normalizeSolicitudPago(item);
      window.showToast?.("Pago actualizado", "success");
    } catch (err) {
      window.showToast?.(err.message, "error");
    }
  }

  filterPago.addEventListener("change", paint);
  filterBuscar.addEventListener("input", paint);
  paint();
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
