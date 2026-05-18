import { api, formatMoney } from "../api.js";
import {
  ESTADO_PAGO_DEFAULT,
  montoCobrado,
  saldoPendiente,
  pagoBadgeClass,
} from "../finanzas.js";

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
      const r = data || {};
      el.innerHTML = `
        <div class="stats-grid" style="margin-top:1rem">
          <div class="stat"><div class="stat-label">Ingresos cobrados</div><div class="stat-value stat-value-ingresos">${formatMoney(r.ingresos_cobrados ?? r.ingresos)}</div></div>
          <div class="stat"><div class="stat-label">Por cobrar</div><div class="stat-value stat-value-por-cobrar">${formatMoney(r.por_cobrar ?? 0)}</div></div>
          <div class="stat"><div class="stat-label">Pend. de pago</div><div class="stat-value">${r.pendientes_pago ?? 0}</div></div>
          <div class="stat"><div class="stat-label">Efectivo</div><div class="stat-value">${r.pagos_efectivo ?? 0}</div></div>
          <div class="stat"><div class="stat-label">Transferencia</div><div class="stat-value">${r.pagos_transferencia ?? 0}</div></div>
          <div class="stat"><div class="stat-label">Parciales</div><div class="stat-value">${r.pagos_parciales ?? 0}</div></div>
        </div>
        <div class="table-wrap" style="margin-top:1.5rem">
          <table>
            <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Pago</th><th>Entrega</th></tr></thead>
            <tbody>
              ${(r.detalle || [])
                .map((row) => {
                  const ep = row.estado_pago || ESTADO_PAGO_DEFAULT;
                  const cobrado = montoCobrado(row);
                  const saldo = saldoPendiente(row);
                  return `<tr>
                    <td>${esc(row.fecha_entrega)}</td>
                    <td>${esc(row.cliente_nombre)}</td>
                    <td>${formatMoney(row.total)}</td>
                    <td>${formatMoney(cobrado)}</td>
                    <td>${formatMoney(saldo)}</td>
                    <td><span class="badge ${pagoBadgeClass(ep)}">${esc(ep)}</span></td>
                    <td><span class="badge badge-${row.estado}">${esc(row.estado)}</span></td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      el.innerHTML = errorCard(e.message);
    }
  }

  document.getElementById("rep-btn").addEventListener("click", load);
  load();
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
          <button type="submit" class="btn btn-primary">Guardar</button>
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
      refresh();
      window.showToast?.("Guardado", "success");
    } catch (e) {
      window.showToast?.(e.message, "error");
    }
  });

  document.getElementById("crud-reset").addEventListener("click", () => {
    form.reset();
    document.getElementById("crud-id").value = "";
  });

  refresh();
}
