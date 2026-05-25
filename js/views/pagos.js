import {
  api,
  formatMoney,
  sortByRecogida,
  formatFechaHoraRecogida,
  formatDuracionAlquiler,
  isRecogidaVencida,
} from "../api.js";
import { getFechaHoraRecogida } from "../alquiler.js";
import {
  ESTADOS_PAGO,
  ESTADO_PAGO_DEFAULT,
  montoCobrado,
  saldoPendiente,
  pagoBadgeClass,
  normalizeSolicitudPago,
  buildPagosStats,
  isOrdenVisibleEnPagos,
  tieneSaldoPorCobrar,
  isOrdenCobradaCompleta,
  normalizarEstadoPago,
} from "../finanzas.js";
import {
  ESTADOS_GESTION,
  normalizarEstadoGestion,
  puedeCambiarGestionEnPagos,
  esTransicionRecogidaEnPagos,
} from "../estados.js";

let pagoDialogBound = false;
let modalContext = null;

/** Prioridad en Por cobrar: recogida con saldo primero, luego entregada, confirmada. */
function sortPorCobrar(items) {
  function prioridad(item) {
    const eg = normalizarEstadoGestion(item.estado);
    if (eg === "recogida") return 0;
    if (eg === "entregada") return 1;
    if (eg === "confirmada") return 2;
    return 3;
  }

  return [...items].sort((a, b) => {
    const pa = prioridad(a);
    const pb = prioridad(b);
    if (pa !== pb) return pa - pb;
    const ra = getFechaHoraRecogida(a)?.getTime() ?? 0;
    const rb = getFechaHoraRecogida(b)?.getTime() ?? 0;
    if (ra !== rb) return ra - rb;
    return saldoPendiente(b) - saldoPendiente(a);
  });
}

function setupViewTabs(container, panels) {
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
    });
  });
}

export async function renderPagos(container) {
  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando pagos...</div>`;

  try {
    const { data } = await api.getSolicitudes();
    const items = sortByRecogida(
      (data || [])
        .map(normalizeSolicitudPago)
        .filter((i) => isOrdenVisibleEnPagos(i)),
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

  const stats = buildPagosStats(items);

  container.innerHTML = `
    <div class="stats-grid pagos-stats">
      <div class="stat">
        <div class="stat-label">Por cobrar</div>
        <div class="stat-value stat-value-por-cobrar" id="pagos-stat-por-cobrar">${formatMoney(stats.por_cobrar)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Cobrado</div>
        <div class="stat-value stat-value-ingresos" id="pagos-stat-cobrado">${formatMoney(stats.cobrado_total)}</div>
        <div class="stat-hint" id="pagos-stat-cobrado-detalle">En ruta ${formatMoney(stats.cobrado_en_ruta)} · Recogidas ${formatMoney(stats.cobrado_recogidas)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Pendientes de pago</div>
        <div class="stat-value" id="pagos-stat-pendientes">${stats.pendientes_pago}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Listos para recoger</div>
        <div class="stat-value" id="pagos-stat-recoger">${stats.listos_recoger}</div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 0.35rem">Cobros en recogida</h2>
      <nav class="report-tabs" role="tablist" aria-label="Cobros">
        <button type="button" class="report-tab active" role="tab" aria-selected="true" data-tab="cobrar" id="pagos-tab-cobrar">
          Por cobrar <span class="report-tab-count" id="pagos-count-cobrar">${stats.count_por_cobrar}</span>
        </button>
        <button type="button" class="report-tab" role="tab" aria-selected="false" data-tab="pagadas" id="pagos-tab-pagadas">
          Ya pagadas <span class="report-tab-count" id="pagos-count-pagadas">${stats.count_ya_pagadas}</span>
        </button>
      </nav>
      <div id="pagos-panel-cobrar" class="report-panel" role="tabpanel" aria-labelledby="pagos-tab-cobrar">
        <p class="hint report-rango-hint">Saldo pendiente primero (recogidas con pago parcial al inicio). Luego el resto por fecha de recogida.</p>
        <div class="filters">
          <label class="field">
            <span>Gestion</span>
            <select id="filter-gestion">
              <option value="">Todas con saldo</option>
              ${ESTADOS_GESTION.filter((e) => e === "confirmada" || e === "entregada" || e === "recogida")
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
      <div id="pagos-panel-pagadas" class="report-panel" role="tabpanel" aria-labelledby="pagos-tab-pagadas" hidden>
        <p class="hint report-rango-hint">Cobros ya registrados (efectivo, transferencia o parcial).</p>
        <label class="field entregas-buscar">
          <span>Buscar</span>
          <input type="search" id="filter-pagadas-buscar" placeholder="Cliente, telefono o lavadora" />
        </label>
        <div id="pagos-list-pagadas"></div>
      </div>
    </div>
  `;

  const listEl = document.getElementById("pagos-list");
  const listPagadas = document.getElementById("pagos-list-pagadas");
  const filterGestion = document.getElementById("filter-gestion");
  const filterPago = document.getElementById("filter-pago");
  const filterBuscar = document.getElementById("filter-pago-buscar");
  const filterPagadasBuscar = document.getElementById("filter-pagadas-buscar");
  const countCobrar = document.getElementById("pagos-count-cobrar");
  const countPagadas = document.getElementById("pagos-count-pagadas");

  function updateStats() {
    const s = buildPagosStats(items);
    document.getElementById("pagos-stat-por-cobrar").textContent = formatMoney(s.por_cobrar);
    document.getElementById("pagos-stat-cobrado").textContent = formatMoney(s.cobrado_total);
    const detalle = document.getElementById("pagos-stat-cobrado-detalle");
    if (detalle) {
      detalle.textContent = `En ruta ${formatMoney(s.cobrado_en_ruta)} · Recogidas ${formatMoney(s.cobrado_recogidas)}`;
    }
    document.getElementById("pagos-stat-pendientes").textContent = String(s.pendientes_pago);
    document.getElementById("pagos-stat-recoger").textContent = String(s.listos_recoger);
  }

  function renderItemSummary(item) {
    const cobrado = montoCobrado(item);
    const saldo = saldoPendiente(item);
    const ep = item.estado_pago || ESTADO_PAGO_DEFAULT;
    const eg = item.estado || "pendiente";
    const vencida = isRecogidaVencida(item);
    const saldoPend = saldo > 0;
    const recogidaConSaldo =
      normalizarEstadoGestion(eg) === "recogida" && saldoPend;

    return {
      cobrado,
      saldo,
      ep,
      eg,
      vencida,
      saldoPend,
      recogidaConSaldo,
      html: `
        <strong>${escapeHtml(item.cliente_nombre)}</strong>
        <div class="pagos-sub">${escapeHtml(item.cliente_telefono || "")}</div>
        <div class="pagos-sub">Direccion: ${escapeHtml(item.direccion || "-")}</div>
        <div class="pagos-sub">${escapeHtml(item.lavadora_codigo || "-")} · ${formatDuracionAlquiler(item)}</div>
      `,
      badges: `
        <span class="badge badge-${eg}">${escapeHtml(eg)}</span>
        <span class="badge ${pagoBadgeClass(ep)}">${escapeHtml(ep)}</span>
        ${recogidaConSaldo ? '<span class="badge badge-urgente">Cobrar saldo</span>' : ""}
        ${vencida ? '<span class="badge badge-urgente">Recoger ya</span>' : ""}
      `,
      money: `
        <div class="pagos-money-row"><span>Total</span><strong>${formatMoney(item.total)}</strong></div>
        <div class="pagos-money-row"><span>Cobrado</span><span>${formatMoney(cobrado)}</span></div>
        <div class="pagos-money-row ${saldo > 0 ? "pagos-saldo-pendiente" : ""}"><span>Saldo</span><strong>${formatMoney(saldo)}</strong></div>
      `,
    };
  }

  function updateTabCounts() {
    const s = buildPagosStats(items);
    if (countCobrar) countCobrar.textContent = String(s.count_por_cobrar);
    if (countPagadas) countPagadas.textContent = String(s.count_ya_pagadas);
  }

  function mountList(targetEl, filtered, emptyMsg) {
    if (!filtered.length) {
      targetEl.innerHTML = `<div class="empty">${emptyMsg}</div>`;
      return;
    }

    const cardsHtml = filtered
      .map((item) => {
        const s = renderItemSummary(item);
        return `
        <article class="pagos-card ${s.vencida ? "pagos-card-listo" : ""} ${s.recogidaConSaldo ? "pagos-card-cobrar-prioridad" : ""}" data-id="${item.id}">
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
        <tr data-id="${item.id}" class="${s.vencida ? "pagos-row-listo" : ""} ${s.recogidaConSaldo ? "pagos-row-cobrar-prioridad" : ""}">
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

    targetEl.innerHTML = `
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

    targetEl.querySelectorAll(".btn-actualizar-pago").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = items.find((i) => i.id === btn.dataset.id);
        if (item) openPagoDialog(item);
      });
    });
  }

  function paintCobrar() {
    let filtered = sortPorCobrar(items.filter((i) => tieneSaldoPorCobrar(i)));
    const eg = filterGestion.value;
    const ep = filterPago.value;
    const q = filterBuscar.value.trim().toLowerCase();

    if (eg) filtered = filtered.filter((i) => normalizarEstadoGestion(i.estado) === eg);
    if (ep) filtered = filtered.filter((i) => normalizarEstadoPago(i.estado_pago) === ep);
    if (q) {
      filtered = filtered.filter(
        (i) =>
          (i.cliente_nombre || "").toLowerCase().includes(q) ||
          (i.cliente_telefono || "").includes(q) ||
          (i.lavadora_codigo || "").toLowerCase().includes(q)
      );
    }

    mountList(
      listEl,
      filtered,
      "No hay ordenes por cobrar con esos filtros."
    );
  }

  function paintPagadas() {
    let filtered = sortByRecogida(
      items.filter((i) => isOrdenCobradaCompleta(i)),
      { descendente: false }
    );
    const q = filterPagadasBuscar.value.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (i) =>
          (i.cliente_nombre || "").toLowerCase().includes(q) ||
          (i.cliente_telefono || "").includes(q) ||
          (i.lavadora_codigo || "").toLowerCase().includes(q)
      );
    }

    mountList(
      listPagadas,
      filtered,
      "No hay ordenes pagadas con ese criterio."
    );
  }

  function repaintAll() {
    updateTabCounts();
    updateStats();
    paintCobrar();
    paintPagadas();
  }

  async function guardarSolicitud(id, payload, item, mensaje) {
    try {
      const res = await api.updateSolicitud(id, payload);
      Object.assign(item, res.data || payload);
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
      onSaved: () => {
        repaintAll();
      },
      guardar: guardarSolicitud,
    };
    fillPagoDialog(item);
    document.getElementById("dialog-pago-update")?.showModal();
  }

  setupViewTabs(container, {
    cobrar: document.getElementById("pagos-panel-cobrar"),
    pagadas: document.getElementById("pagos-panel-pagadas"),
  });

  filterGestion.addEventListener("change", repaintAll);
  filterPago.addEventListener("change", repaintAll);
  filterBuscar.addEventListener("input", repaintAll);
  filterPagadasBuscar.addEventListener("input", repaintAll);
  repaintAll();
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
  const submitBtn = document.getElementById("dialog-pago-confirmar");
  const submitLabel = submitBtn?.textContent || "Confirmar cambios";

  if (!dialog || !form) return;

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

  selPago.innerHTML = ESTADOS_PAGO.map((e) => `<option value="${e}">${e}</option>`).join("");

  function closeDialog() {
    dialog.close();
    modalContext = null;
    resetSubmitBtn();
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
    if (!modalContext || submitBtn?.disabled) return;

    const { item, snapshot, onSaved, guardar } = modalContext;
    const nuevoGestion = selGestion.value;
    const nuevoPago = selPago.value;
    const payload = {};

    if (nuevoGestion !== snapshot.estado) {
      if (!esTransicionRecogidaEnPagos(snapshot.estado, nuevoGestion)) {
        window.showToast?.(
          "Solo puedes cambiar la gestion de entregada a recogida",
          "error"
        );
        return;
      }
      payload.estado = nuevoGestion;
    }
    if (nuevoPago !== snapshot.estado_pago) payload.estado_pago = nuevoPago;

    if (nuevoPago === "pago parcial") {
      const monto = Number(montoInput.value);
      if (!monto || monto < 0) {
        window.showToast?.("Indica el monto pagado", "error");
        return;
      }
      const montoPrevio = Number(snapshot.monto_pagado) || 0;
      if (nuevoPago !== snapshot.estado_pago || monto !== montoPrevio) {
        payload.monto_pagado = monto;
      }
    } else if (nuevoPago !== snapshot.estado_pago) {
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

    setSubmitLoading();
    const ok = await guardar(item.id, payload, item, "Cambios guardados");
    if (!ok) {
      resetSubmitBtn();
      return;
    }

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
  const gestionHint = document.getElementById("dialog-pago-gestion-hint");

  const eg = item.estado || "pendiente";
  const ep = item.estado_pago || ESTADO_PAGO_DEFAULT;
  const saldo = saldoPendiente(item);

  resumen.innerHTML = `
    <p><strong>${escapeHtml(item.cliente_nombre)}</strong></p>
    <p class="pagos-sub">${escapeHtml(item.cliente_telefono || "")}</p>
    <p class="pagos-sub">Direccion: ${escapeHtml(item.direccion || "-")}</p>
    <p>Recogida: <strong>${formatFechaHoraRecogida(item)}</strong></p>
    <p>Lavadora: ${escapeHtml(item.lavadora_codigo || "-")} · ${formatDuracionAlquiler(item)}</p>
    <p>Total ${formatMoney(item.total)} · Saldo ${formatMoney(saldo)}</p>
  `;

  if (puedeCambiarGestionEnPagos(eg)) {
    selGestion.disabled = false;
    selGestion.innerHTML = `
      <option value="entregada">entregada</option>
      <option value="recogida">recogida</option>
    `;
    selGestion.value = "entregada";
    if (gestionHint) {
      gestionHint.hidden = false;
      gestionHint.textContent =
        "Al recoger la lavadora, cambia la gestion de entregada a recogida.";
    }
  } else {
    selGestion.disabled = true;
    selGestion.innerHTML = `<option value="${escapeHtml(eg)}">${escapeHtml(eg)}</option>`;
    selGestion.value = eg;
    if (gestionHint) {
      gestionHint.hidden = false;
      gestionHint.textContent =
        "La gestion no se puede cambiar aqui. Marca la entrega en Entregas hoy antes de recoger.";
    }
  }

  selPago.value = ep;
  montoInput.value = item.monto_pagado !== "" && item.monto_pagado != null ? item.monto_pagado : "";
  montoInput.max = Number(item.total) || 0;
  montoWrap.classList.toggle("hidden", ep !== "pago parcial");
  cambiosEl.hidden = true;
  cambiosEl.textContent = "";

  const submitBtn = document.getElementById("dialog-pago-confirmar");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar cambios";
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
