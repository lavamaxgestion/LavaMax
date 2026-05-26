import { api, formatMoney } from "../api.js";
import {
  ESTADO_PAGO_DEFAULT,
  ESTADOS_PAGO,
  montoCobrado,
  saldoPendiente,
  pagoBadgeClass,
  debeMostrarBadgePago,
  normalizarEstadoPago,
  cuentaEnCarteraReporteAdmin,
} from "../finanzas.js";
import { ESTADOS_GESTION, normalizarEstadoGestion } from "../estados.js";

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

export async function renderInventario(container) {
  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando...</div>`;
  try {
    const { data } = await api.getInventario();
    renderCrudTable(container, {
      title: "Inventario de lavadoras",
      columns: ["codigo", "modelo", "capacidad_kg", "estado"],
      items: data || [],
      fields: [
        { name: "codigo", label: "Codigo", required: true },
        { name: "modelo", label: "Modelo", required: true },
        { name: "capacidad_kg", label: "Capacidad (kg)", type: "number" },
        {
          name: "estado",
          label: "Estado",
          type: "select",
          options: ["disponible", "alquilada", "mantenimiento"],
        },
      ],
      onSave: (p) => api.saveInventario(p),
      onDelete: (id) => api.deleteInventario(id),
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

export async function renderTarifas(container) {
  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando...</div>`;
  try {
    const { data } = await api.getTarifas();
    renderCrudTable(container, {
      title: "Tarifas de alquiler",
      columns: ["nombre", "horas_duracion", "precio_dia", "descripcion"],
      items: data || [],
      fields: [
        { name: "nombre", label: "Nombre", required: true },
        {
          name: "horas_duracion",
          label: "Duracion (horas)",
          type: "select",
          options: ["12", "24"],
        },
        { name: "precio_dia", label: "Precio del periodo", type: "number", required: true },
        { name: "descripcion", label: "Descripcion" },
      ],
      onSave: (p) => api.saveTarifa(p),
      onDelete: (id) => api.deleteTarifa(id),
      formatCell: (col, val) =>
        col === "precio_dia" ? formatMoney(val) : esc(String(val ?? "")),
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

export async function renderUsuarios(container) {
  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando...</div>`;
  try {
    const { data } = await api.getUsuarios();
    renderCrudTable(container, {
      title: "Usuarios del sistema",
      columns: ["nombre", "email", "rol", "pin", "activo"],
      items: data || [],
      fields: [
        { name: "nombre", label: "Nombre", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        {
          name: "rol",
          label: "Rol",
          type: "select",
          options: ["admin", "operador", "repartidor"],
        },
        {
          name: "pin",
          label: "PIN de acceso (4-6 digitos)",
          type: "password",
          inputmode: "numeric",
          pattern: "[0-9]{4,6}",
          required: true,
        },
        { name: "activo", label: "Activo (si/no)", placeholder: "si" },
      ],
      onSave: (p) => api.saveUsuario(p),
      onDelete: (id) => api.deleteUsuario(id),
      formatCell: (col, val) =>
        col === "pin" ? (val ? "****" : "-") : esc(String(val ?? "")),
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

export async function renderReportes(container) {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const fin = hoy.toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 1rem">Reportes financieros</h2>
      <div class="filters">
        <label class="field">
          <span>Desde</span>
          <input type="date" id="rep-desde" value="${inicio}" />
        </label>
        <label class="field">
          <span>Hasta</span>
          <input type="date" id="rep-hasta" value="${fin}" />
        </label>
        <button type="button" class="btn btn-primary" id="rep-btn">Generar</button>
      </div>
      <div id="rep-content"></div>
    </div>
  `;

  async function load() {
    const desde = document.getElementById("rep-desde").value;
    const hasta = document.getElementById("rep-hasta").value;
    const el = document.getElementById("rep-content");
    el.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
    try {
      const { data } = await api.getReportes(desde, hasta);
      mountReportesTabs(el, data || {}, { desde, hasta });
    } catch (e) {
      el.innerHTML = errorCard(e.message);
    }
  }

  document.getElementById("rep-btn").addEventListener("click", load);
  load();
}

function mountReportesTabs(container, report, rango) {
  const cobros = report.detalle || [];
  const canceladas = report.detalle_canceladas || [];
  const nCanceladas = canceladas.length;

  container.innerHTML = `
    <nav class="report-tabs" role="tablist" aria-label="Tipo de reporte">
      <button type="button" class="report-tab active" role="tab" aria-selected="true" data-tab="cobros" id="rep-tab-cobros">
        Cobros y pagos
      </button>
      <button type="button" class="report-tab" role="tab" aria-selected="false" data-tab="canceladas" id="rep-tab-canceladas">
        Canceladas <span class="report-tab-count">${nCanceladas}</span>
      </button>
    </nav>
    <p class="hint report-rango-hint">Periodo: ${esc(rango.desde)} — ${esc(rango.hasta)}</p>
    <div id="rep-panel-cobros" class="report-panel" role="tabpanel" aria-labelledby="rep-tab-cobros"></div>
    <div id="rep-panel-canceladas" class="report-panel" role="tabpanel" aria-labelledby="rep-tab-canceladas" hidden></div>
  `;

  setupReportTabSwitch(container);
  mountPanelCobros(container.querySelector("#rep-panel-cobros"), report, cobros);
  mountPanelCanceladas(container.querySelector("#rep-panel-canceladas"), canceladas);
}

function setupReportTabSwitch(container) {
  const tabs = container.querySelectorAll(".report-tab");
  const panels = {
    cobros: container.querySelector("#rep-panel-cobros"),
    canceladas: container.querySelector("#rep-panel-canceladas"),
  };

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

function mountPanelCobros(panel, report, rows) {
  panel.innerHTML = `
    <div class="stats-grid report-stats">
      <div class="stat"><div class="stat-label">Ingresos cobrados</div><div class="stat-value stat-value-ingresos" id="rep-stat-ingresos">${formatMoney(report.ingresos_cobrados ?? report.ingresos)}</div></div>
      <div class="stat"><div class="stat-label">Por cobrar</div><div class="stat-value stat-value-por-cobrar" id="rep-stat-por-cobrar">${formatMoney(report.por_cobrar ?? 0)}</div></div>
      <div class="stat"><div class="stat-label">Pend. de pago</div><div class="stat-value" id="rep-stat-pend-pago">${report.pendientes_pago ?? 0}</div></div>
      <div class="stat"><div class="stat-label">Efectivo</div><div class="stat-value">${report.pagos_efectivo ?? 0}</div></div>
      <div class="stat"><div class="stat-label">Transferencia</div><div class="stat-value">${report.pagos_transferencia ?? 0}</div></div>
      <div class="stat"><div class="stat-label">Parciales</div><div class="stat-value">${report.pagos_parciales ?? 0}</div></div>
    </div>
    <p class="hint report-cartera-hint">Por cobrar y Pend. de pago solo incluyen ordenes con gestion <strong>entregada</strong>.</p>
    <div class="filters report-filters">
      <label class="field">
        <span>Estado de pago</span>
        <select id="rep-filter-pago">
          <option value="">Todos</option>
          ${ESTADOS_PAGO.map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span>Gestion</span>
        <select id="rep-filter-gestion">
          <option value="">Todos</option>
          ${ESTADOS_GESTION.filter((e) => e !== "cancelada")
            .map((e) => `<option value="${e}">${e}</option>`)
            .join("")}
        </select>
      </label>
      <label class="field">
        <span>Buscar cliente</span>
        <input type="search" id="rep-filter-buscar" placeholder="Nombre o telefono" />
      </label>
    </div>
    <div class="table-wrap report-table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Pago</th><th>Gestion</th></tr></thead>
        <tbody id="rep-tbody-cobros"></tbody>
      </table>
    </div>
  `;

  const tbody = panel.querySelector("#rep-tbody-cobros");
  const filterPago = panel.querySelector("#rep-filter-pago");
  const filterGestion = panel.querySelector("#rep-filter-gestion");
  const filterBuscar = panel.querySelector("#rep-filter-buscar");

  function paintCobros() {
    const filtered = filtrarFilasReporte(rows, {
      estadoPago: filterPago.value,
      estadoGestion: filterGestion.value,
      buscar: filterBuscar.value,
    });
    tbody.innerHTML = renderFilasTablaCobros(filtered);
    actualizarStatsCobrosFiltradas(panel, filtered);
  }

  filterPago.addEventListener("change", paintCobros);
  filterGestion.addEventListener("change", paintCobros);
  filterBuscar.addEventListener("input", paintCobros);
  paintCobros();
}

function mountPanelCanceladas(panel, rows) {
  panel.innerHTML = `
    <div class="stats-grid report-stats" id="rep-stats-canceladas"></div>
    <div class="filters report-filters">
      <label class="field">
        <span>Buscar cliente</span>
        <input type="search" id="rep-filter-cancel-buscar" placeholder="Nombre o telefono" />
      </label>
    </div>
    <div class="table-wrap report-table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Telefono</th><th>Total</th><th>Gestion</th></tr></thead>
        <tbody id="rep-tbody-canceladas"></tbody>
      </table>
    </div>
  `;

  const tbody = panel.querySelector("#rep-tbody-canceladas");
  const statsEl = panel.querySelector("#rep-stats-canceladas");
  const filterBuscar = panel.querySelector("#rep-filter-cancel-buscar");

  function paintCanceladas() {
    const filtered = filtrarFilasReporte(rows, {
      buscar: filterBuscar.value,
    });
    statsEl.innerHTML = renderStatsCanceladas(filtered, rows.length);
    tbody.innerHTML = renderFilasTablaCanceladas(filtered);
  }

  filterBuscar.addEventListener("input", paintCanceladas);
  paintCanceladas();
}

function filtrarFilasReporte(rows, { estadoPago, estadoGestion, buscar }) {
  let f = rows;
  if (estadoPago) {
    f = f.filter(
      (r) => (normalizarEstadoPago(r.estado_pago) || ESTADO_PAGO_DEFAULT) === estadoPago
    );
  }
  if (estadoGestion) {
    f = f.filter((r) => normalizarEstadoGestion(r.estado) === estadoGestion);
  }
  const q = (buscar || "").trim().toLowerCase();
  if (q) {
    f = f.filter(
      (r) =>
        (r.cliente_nombre || "").toLowerCase().includes(q) ||
        (r.cliente_telefono || "").includes(q)
    );
  }
  return f;
}

function actualizarStatsCobrosFiltradas(panel, filtered) {
  let ingresos = 0;
  let porCobrar = 0;
  let pendientes = 0;
  filtered.forEach((r) => {
    ingresos += montoCobrado(r);
    if (!cuentaEnCarteraReporteAdmin(r)) return;
    porCobrar += saldoPendiente(r);
    if ((normalizarEstadoPago(r.estado_pago) || ESTADO_PAGO_DEFAULT) === ESTADO_PAGO_DEFAULT) {
      pendientes++;
    }
  });
  const elIng = panel.querySelector("#rep-stat-ingresos");
  const elPor = panel.querySelector("#rep-stat-por-cobrar");
  const elPend = panel.querySelector("#rep-stat-pend-pago");
  if (elIng) elIng.textContent = formatMoney(ingresos);
  if (elPor) elPor.textContent = formatMoney(porCobrar);
  if (elPend) elPend.textContent = String(pendientes);
}

function renderStatsCanceladas(filtered, totalEnRango) {
  const valor = filtered.reduce((s, r) => s + (Number(r.total) || 0), 0);
  return `
    <div class="stat"><div class="stat-label">Canceladas (filtradas)</div><div class="stat-value">${filtered.length}</div></div>
    <div class="stat"><div class="stat-label">Valor total filtrado</div><div class="stat-value">${formatMoney(valor)}</div></div>
    <div class="stat"><div class="stat-label">Total en periodo</div><div class="stat-value">${totalEnRango}</div></div>
  `;
}

function renderCeldaPagoReporte(row) {
  if (!debeMostrarBadgePago(row.estado)) return "—";
  const ep = normalizarEstadoPago(row.estado_pago) || ESTADO_PAGO_DEFAULT;
  return `<span class="badge ${pagoBadgeClass(ep)}">${esc(ep)}</span>`;
}

function renderFilasTablaCobros(rows) {
  if (!rows.length) {
    return `<tr><td colspan="7" class="empty">No hay ordenes con esos filtros.</td></tr>`;
  }
  return rows
    .map((row) => {
      const cobrado = montoCobrado(row);
      const saldo = saldoPendiente(row);
      return `<tr>
        <td>${esc(row.fecha_entrega)}</td>
        <td>${esc(row.cliente_nombre)}</td>
        <td>${formatMoney(row.total)}</td>
        <td>${formatMoney(cobrado)}</td>
        <td>${formatMoney(saldo)}</td>
        <td>${renderCeldaPagoReporte(row)}</td>
        <td><span class="badge badge-${row.estado}">${esc(row.estado)}</span></td>
      </tr>`;
    })
    .join("");
}

function renderFilasTablaCanceladas(rows) {
  if (!rows.length) {
    return `<tr><td colspan="5" class="empty">No hay ordenes canceladas con esos filtros.</td></tr>`;
  }
  return rows
    .map(
      (row) => `<tr>
        <td>${esc(row.fecha_entrega)}</td>
        <td>${esc(row.cliente_nombre)}</td>
        <td>${esc(row.cliente_telefono || "-")}</td>
        <td>${formatMoney(row.total)}</td>
        <td><span class="badge badge-cancelada">cancelada</span></td>
      </tr>`
    )
    .join("");
}

function errorCard(msg) {
  return `<div class="card empty"><strong>Error</strong><p>${esc(msg)}</p></div>`;
}

function renderCrudTable(container, cfg) {
  const { title, columns, items, fields, onSave, onDelete, formatCell } = cfg;

  container.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 1rem">${esc(title)}</h2>
      <form id="crud-form" class="form-grid" style="margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
        <input type="hidden" name="id" id="crud-id" />
        ${fields
          .map((f) => {
            if (f.type === "select") {
              return `<label class="field"><span>${esc(f.label)}</span>
                <select name="${f.name}" ${f.required ? "required" : ""}>
                  ${(f.options || []).map((o) => `<option value="${o}">${o}</option>`).join("")}
                </select></label>`;
            }
            return `<label class="field"><span>${esc(f.label)}</span>
              <input name="${f.name}" type="${f.type || "text"}" ${f.required ? "required" : ""} placeholder="${esc(f.placeholder || "")}" /></label>`;
          })
          .join("")}
        <div class="form-actions field-full">
          <button type="button" class="btn btn-ghost" id="crud-reset">Limpiar</button>
          <button type="submit" class="btn btn-primary" id="crud-submit">Guardar</button>
        </div>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}<th></th></tr></thead>
          <tbody id="crud-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = document.getElementById("crud-tbody");
  const form = document.getElementById("crud-form");
  const submitBtn = document.getElementById("crud-submit");
  const submitLabel = submitBtn?.textContent || "Guardar";

  function resetSubmitBtn() {
    if (!submitBtn) return;
    submitBtn.disabled = false;
    submitBtn.textContent = submitLabel;
  }

  function refresh() {
    tbody.innerHTML = items
      .map(
        (row) => `<tr>
          ${columns
            .map((c) => {
              const v = row[c];
              const cell = formatCell ? formatCell(c, v, row) : esc(String(v ?? ""));
              return `<td>${cell}</td>`;
            })
            .join("")}
          <td>
            <button type="button" class="btn btn-ghost btn-sm" data-edit='${JSON.stringify(row).replace(/'/g, "&#39;")}'>Editar</button>
            <button type="button" class="btn btn-ghost btn-sm" data-del="${row.id}">Eliminar</button>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = JSON.parse(btn.getAttribute("data-edit"));
        document.getElementById("crud-id").value = row.id || "";
        fields.forEach((f) => {
          const inp = form.elements[f.name];
          if (inp) inp.value = row[f.name] ?? "";
        });
      });
    });

    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Eliminar registro?")) return;
        try {
          await onDelete(btn.dataset.del);
          const i = items.findIndex((x) => x.id === btn.dataset.del);
          if (i >= 0) items.splice(i, 1);
          refresh();
          window.showToast?.("Eliminado", "success");
        } catch (e) {
          window.showToast?.(e.message, "error");
        }
      });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn?.disabled) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando...";
    }

    const fd = new FormData(form);
    const payload = { id: fd.get("id") || undefined };
    fields.forEach((f) => {
      payload[f.name] = fd.get(f.name);
    });
    try {
      const res = await onSave(payload);
      const saved = res.data;
      const idx = items.findIndex((x) => x.id === saved.id);
      if (idx >= 0) items[idx] = saved;
      else items.push(saved);
      form.reset();
      document.getElementById("crud-id").value = "";
      resetSubmitBtn();
      refresh();
      window.showToast?.("Guardado", "success");
    } catch (e) {
      resetSubmitBtn();
      window.showToast?.(e.message, "error");
    }
  });

  document.getElementById("crud-reset").addEventListener("click", () => {
    form.reset();
    document.getElementById("crud-id").value = "";
    resetSubmitBtn();
  });

  refresh();
}
