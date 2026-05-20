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
  getFechaHoraRecogida,
} from "../alquiler.js";
import {
  ESTADOS_GESTION,
  isOrdenActiva,
  opcionesGestionOrdenes,
  puedeEditarGestionEnOrdenes,
  ESTADOS_GESTION_ORDENES,
  hoyISO,
} from "../estados.js";

export async function renderOrdenes(container, topbar) {
  topbar.innerHTML = `
    <a href="#/nueva" class="btn btn-primary">+ Nueva solicitud</a>
  `;

  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando ordenes...</div>`;

  try {
    const { data } = await api.getSolicitudes();
    const items = sortByEntrega((data || []).map(normalizeSolicitudPago));
    renderList(container, items);
  } catch (err) {
    container.innerHTML = `
      <div class="card empty">
        <strong>No se pudieron cargar las ordenes</strong>
        <p>${err.message}</p>
        <p><button type="button" class="btn btn-primary" id="btn-open-api">Configurar API</button></p>
      </div>`;
    document.getElementById("btn-open-api")?.addEventListener("click", () => {
      document.getElementById("btn-config-api")?.click();
    });
  }
}

function renderList(container, items) {
  const hoy = hoyISO();
  const pendientes = items.filter(isOrdenActiva);
  const entregasHoy = items.filter((i) => i.fecha_entrega === hoy && isOrdenActiva(i)).length;
  const recogidas = items.filter((i) => i.estado === "recogida").length;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Pendientes de entregar</div>
        <div class="stat-value">${pendientes.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Entregas hoy</div>
        <div class="stat-value">${entregasHoy}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Recogidas</div>
        <div class="stat-value">${recogidas}</div>
      </div>
    </div>

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
          <span>Fecha</span>
          <input type="date" id="filter-fecha" value="${hoy}" />
        </label>
        <label class="field">
          <span>Buscar cliente</span>
          <input type="search" id="filter-buscar" placeholder="Nombre o telefono" />
        </label>
        <button type="button" class="btn btn-ghost btn-sm" id="filter-limpiar-fecha">Limpiar fecha</button>
      </div>
      <div id="orders-list"></div>
    </div>
  `;

  const listEl = document.getElementById("orders-list");
  const filterEstado = document.getElementById("filter-estado");
  const filterBuscar = document.getElementById("filter-buscar");
  const filterFecha = document.getElementById("filter-fecha");
  const filterFechaTipo = document.getElementById("filter-fecha-tipo");
  const filterLimpiarFecha = document.getElementById("filter-limpiar-fecha");

  function matchFecha(item, fecha) {
    if (filterFechaTipo.value === "recogida") {
      const recogida = getFechaHoraRecogida(item);
      if (!recogida) return false;
      const y = recogida.getFullYear();
      const m = String(recogida.getMonth() + 1).padStart(2, "0");
      const d = String(recogida.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}` === fecha;
    }
    return item.fecha_entrega === fecha;
  }

  function paint() {
    let filtered = sortByEntrega(items);
    const estado = filterEstado.value;
    const fecha = filterFecha.value;
    const q = filterBuscar.value.trim().toLowerCase();

    if (estado) filtered = filtered.filter((i) => i.estado === estado);
    if (fecha) filtered = filtered.filter((i) => matchFecha(i, fecha));
    if (q) {
      filtered = filtered.filter(
        (i) =>
          (i.cliente_nombre || "").toLowerCase().includes(q) ||
          (i.cliente_telefono || "").includes(q)
      );
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">No hay ordenes con esos filtros.</div>`;
      return;
    }

    listEl.innerHTML = filtered
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
          const item = items.find((i) => i.id === id);
          if (item) item.estado = nuevo;
          e.target.dataset.estadoActual = nuevo;
          window.showToast?.("Estado actualizado", "success");
          paint();
        } catch (err) {
          e.target.value = prev;
          window.showToast?.(err.message, "error");
        }
      });
    });
  }

  filterEstado.addEventListener("change", paint);
  filterBuscar.addEventListener("input", paint);
  filterFecha.addEventListener("change", paint);
  filterFechaTipo.addEventListener("change", paint);
  filterLimpiarFecha.addEventListener("click", () => {
    filterFecha.value = "";
    paint();
  });
  paint();
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
