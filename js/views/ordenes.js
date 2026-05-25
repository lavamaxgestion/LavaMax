import { api, sortByEntrega, isUrgent, formatDate, formatMoney } from "../api.js";
import {
  ESTADO_PAGO_DEFAULT,
  pagoBadgeClass,
  normalizeSolicitudPago,
  debeMostrarBadgePago,
  normalizarEstadoPago,
} from "../finanzas.js";
import {
  formatFechaHoraRecogida,
  formatDuracionAlquiler,
} from "../alquiler.js";
import {
  ESTADOS_GESTION,
  opcionesGestionOrdenes,
  puedeEditarGestionEnOrdenes,
  ESTADOS_GESTION_ORDENES,
  hoyISO,
} from "../estados.js";
import { buildSolicitudesStats } from "../solicitudes-filter.js";

const BUSCAR_DEBOUNCE_MS = 350;

export async function renderOrdenes(container, topbar) {
  topbar.innerHTML = `
    <a href="#/nueva" class="btn btn-primary">+ Nueva solicitud</a>
  `;

  const hoy = hoyISO();
  container.innerHTML = buildShell(hoy);

  const listEl = document.getElementById("orders-list");
  const statsEl = document.getElementById("orders-stats");
  const filterEstado = document.getElementById("filter-estado");
  const filterBuscar = document.getElementById("filter-buscar");
  const filterDesde = document.getElementById("filter-desde");
  const filterHasta = document.getElementById("filter-hasta");
  const filterFechaTipo = document.getElementById("filter-fecha-tipo");
  const filterLimpiarFechas = document.getElementById("filter-limpiar-fechas");

  let items = [];
  let loading = false;
  let buscarTimer = null;

  function readFilters() {
    return {
      estado: filterEstado.value,
      fecha_tipo: filterFechaTipo.value,
      desde: filterDesde.value,
      hasta: filterHasta.value,
      buscar: filterBuscar.value.trim(),
    };
  }

  function paintStats() {
    if (!statsEl) return;
    const stats = buildSolicitudesStats(items, hoyISO());
    statsEl.innerHTML = `
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-label">Pendientes de entregar</div>
          <div class="stat-value">${stats.pendientes}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Entregas hoy</div>
          <div class="stat-value">${stats.entregas_hoy}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Recogidas</div>
          <div class="stat-value">${stats.recogidas}</div>
        </div>
      </div>`;
  }

  function setListLoading() {
    listEl.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando ordenes...</div>`;
  }

  async function loadList() {
    if (loading) return;
    loading = true;
    setListLoading();

    const filters = readFilters();
    if (filters.desde && filters.hasta && filters.desde > filters.hasta) {
      items = [];
      loading = false;
      paintStats();
      listEl.innerHTML = `<div class="empty">La fecha "Desde" no puede ser posterior a "Hasta".</div>`;
      return;
    }

    try {
      const { data } = await api.getSolicitudes(filters);
      items = sortByEntrega((data || []).map(normalizeSolicitudPago));
      paintList();
    } catch (err) {
      items = [];
      paintStats();
      listEl.innerHTML = `
        <div class="card empty">
          <strong>No se pudieron cargar las ordenes</strong>
          <p>${escapeHtml(err.message)}</p>
          <p><button type="button" class="btn btn-primary" id="btn-open-api">Configurar API</button></p>
        </div>`;
      document.getElementById("btn-open-api")?.addEventListener("click", () => {
        document.getElementById("btn-config-api")?.click();
      });
    } finally {
      loading = false;
    }
  }

  function paintList() {
    paintStats();

    if (!items.length) {
      listEl.innerHTML = `<div class="empty">No hay ordenes con esos filtros.</div>`;
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const urgent = isUrgent(item);
        const hora = item.hora_entrega || "--:--";
        return `
        <article class="order-card ${urgent ? "priority" : ""}" data-id="${item.id}">
          <div class="order-time">
            <div class="day">${formatDate(item.fecha_entrega)}</div>
            <div class="hour">${hora}</div>
          </div>
          <div class="order-card-body">
            <div class="order-card-header">
              <strong>${escapeHtml(item.cliente_nombre)}</strong>
              <span class="badge badge-${item.estado}">${item.estado}</span>
              ${renderBadgePago(item)}
              ${urgent ? '<span class="badge badge-urgente">Pronto</span>' : ""}
            </div>
            <div class="order-meta">
              <div>Tel: <strong>${escapeHtml(item.cliente_telefono || "-")}</strong></div>
              <div>${escapeHtml(item.direccion || "Sin direccion")}</div>
              <div>Recogida: <strong>${formatFechaHoraRecogida(item)}</strong> · ${formatDuracionAlquiler(item)}</div>
              <div>Lavadora: <strong>${escapeHtml(item.lavadora_codigo || item.lavadora_id || "-")}</strong> · ${formatMoney(item.total)}</div>
            </div>
            ${item.notas ? `<div class="order-meta">Notas: ${escapeHtml(item.notas)}</div>` : ""}
          </div>
          <div class="order-card-actions">
            ${renderEditarOrdenLink(item)}
            ${renderEstadoOrdenesSelect(item)}
          </div>
        </article>`;
      })
      .join("");

    listEl.querySelectorAll(".estado-select").forEach((sel) => {
      if (sel.disabled) return;
      const prev = sel.dataset.estadoActual;
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const nuevo = e.target.value;
        if (!ESTADOS_GESTION_ORDENES.includes(nuevo)) {
          e.target.value = prev;
          window.showToast?.("Estado no permitido en ordenes", "error");
          return;
        }
        try {
          await api.updateSolicitud(id, { estado: nuevo });
          window.showToast?.("Estado actualizado", "success");
          await loadList();
        } catch (err) {
          e.target.value = prev;
          window.showToast?.(err.message, "error");
        }
      });
    });
  }

  function scheduleListLoad() {
    clearTimeout(buscarTimer);
    buscarTimer = setTimeout(loadList, BUSCAR_DEBOUNCE_MS);
  }

  filterEstado.addEventListener("change", loadList);
  filterDesde.addEventListener("change", loadList);
  filterHasta.addEventListener("change", loadList);
  filterFechaTipo.addEventListener("change", loadList);
  filterBuscar.addEventListener("input", scheduleListLoad);
  filterLimpiarFechas.addEventListener("click", () => {
    filterDesde.value = "";
    filterHasta.value = "";
    loadList();
  });

  statsEl.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
  setListLoading();
  await loadList();
}

function buildShell(hoy) {
  return `
    <div id="orders-stats"></div>

    <div class="card">
      <div class="filters">
        <label class="field">
          <span>Estado</span>
          <select id="filter-estado">
            <option value="">Todos</option>
            ${ESTADOS_GESTION.map((e) => `<option value="${e}">${e}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Filtrar por fecha</span>
          <select id="filter-fecha-tipo">
            <option value="entrega">Fecha de entrega</option>
            <option value="recogida">Fecha de recogida</option>
          </select>
        </label>
        <label class="field">
          <span>Desde</span>
          <input type="date" id="filter-desde" value="${hoy}" />
        </label>
        <label class="field">
          <span>Hasta</span>
          <input type="date" id="filter-hasta" value="${hoy}" />
        </label>
        <label class="field">
          <span>Buscar cliente</span>
          <input type="search" id="filter-buscar" placeholder="Nombre o telefono" />
        </label>
        <button type="button" class="btn btn-ghost btn-sm" id="filter-limpiar-fechas">Limpiar fechas</button>
      </div>
      <div id="orders-list"></div>
    </div>
  `;
}

function renderBadgePago(item) {
  if (!debeMostrarBadgePago(item.estado)) return "";
  const ep = normalizarEstadoPago(item.estado_pago) || ESTADO_PAGO_DEFAULT;
  return `<span class="badge ${pagoBadgeClass(ep)}">${escapeHtml(ep)}</span>`;
}

function renderEditarOrdenLink(item) {
  if (!puedeEditarGestionEnOrdenes(item.estado)) return "";
  const id = encodeURIComponent(item.id);
  return `<a href="#/nueva?id=${id}" class="btn btn-ghost btn-sm">Editar</a>`;
}

function renderEstadoOrdenesSelect(item) {
  const opciones = opcionesGestionOrdenes(item.estado);
  const editable = puedeEditarGestionEnOrdenes(item.estado);
  if (!editable) {
    return `<span class="badge badge-${item.estado}" title="Cambiar en Entregas o Pagos">${escapeHtml(item.estado)}</span>`;
  }
  return `<select class="estado-select" data-id="${item.id}" data-estado-actual="${escapeHtml(item.estado)}">
    ${opciones
      .map(
        (e) =>
          `<option value="${e}" ${e === item.estado ? "selected" : ""}>${e}</option>`
      )
      .join("")}
  </select>`;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
