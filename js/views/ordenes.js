import { api, sortByEntrega, isUrgent, formatDate, formatMoney } from "../api.js";

const ESTADOS = ["pendiente", "confirmada", "entregada", "cancelada"];

export async function renderOrdenes(container, topbar) {
  topbar.innerHTML = `
    <a href="#/nueva" class="btn btn-primary">+ Nueva solicitud</a>
  `;

  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando ordenes...</div>`;

  try {
    const { data } = await api.getSolicitudes();
    const items = sortByEntrega(data || []);
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
  const pendientes = items.filter((i) => i.estado !== "entregada" && i.estado !== "cancelada");
  const hoy = new Date().toISOString().slice(0, 10);
  const entregasHoy = pendientes.filter((i) => i.fecha_entrega === hoy).length;

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
        <div class="stat-label">Total registradas</div>
        <div class="stat-value">${items.length}</div>
      </div>
    </div>

    <div class="card">
      <div class="filters">
        <label class="field">
          <span>Estado</span>
          <select id="filter-estado">
            <option value="">Todos</option>
            ${ESTADOS.map((e) => `<option value="${e}">${e}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Buscar cliente</span>
          <input type="search" id="filter-buscar" placeholder="Nombre o telefono" />
        </label>
      </div>
      <div id="orders-list"></div>
    </div>
  `;

  const listEl = document.getElementById("orders-list");
  const filterEstado = document.getElementById("filter-estado");
  const filterBuscar = document.getElementById("filter-buscar");

  function paint() {
    let filtered = sortByEntrega(items);
    const estado = filterEstado.value;
    const q = filterBuscar.value.trim().toLowerCase();

    if (estado) filtered = filtered.filter((i) => i.estado === estado);
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
          <div>
            <div>
              <strong>${escapeHtml(item.cliente_nombre)}</strong>
              <span class="badge badge-${item.estado}">${item.estado}</span>
              ${urgent ? '<span class="badge badge-urgente">Pronto</span>' : ""}
            </div>
            <div class="order-meta">
              Tel: <strong>${escapeHtml(item.cliente_telefono || "-")}</strong>
              &middot; ${escapeHtml(item.direccion || "Sin direccion")}
              &middot; Lavadora: <strong>${escapeHtml(item.lavadora_codigo || item.lavadora_id || "-")}</strong>
              &middot; ${item.dias_alquiler || 1} dia(s) &middot; ${formatMoney(item.total)}
            </div>
            ${item.notas ? `<div class="order-meta">Notas: ${escapeHtml(item.notas)}</div>` : ""}
          </div>
          <div>
            <select class="estado-select" data-id="${item.id}">
              ${ESTADOS.map(
                (e) =>
                  `<option value="${e}" ${e === item.estado ? "selected" : ""}>${e}</option>`
              ).join("")}
            </select>
          </div>
        </article>`;
      })
      .join("");

    listEl.querySelectorAll(".estado-select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        try {
          await api.updateSolicitud(id, { estado: e.target.value });
          const item = items.find((i) => i.id === id);
          if (item) item.estado = e.target.value;
          window.showToast?.("Estado actualizado", "success");
          paint();
        } catch (err) {
          window.showToast?.(err.message, "error");
        }
      });
    });
  }

  filterEstado.addEventListener("change", paint);
  filterBuscar.addEventListener("input", paint);
  paint();
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
