import { api, formatMoney } from "../api.js";

export async function renderNuevaSolicitud(container, topbar) {
  topbar.innerHTML = "";

  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando formulario...</div>`;

  let inventario = [];
  let tarifas = [];

  try {
    const [invRes, tarRes] = await Promise.all([
      api.getInventario().catch(() => ({ data: [] })),
      api.getTarifas().catch(() => ({ data: [] })),
    ]);
    inventario = (invRes.data || []).filter((i) => i.estado === "disponible");
    tarifas = tarRes.data || [];
  } catch {
    /* demo sin API */
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const tarifaDefault = tarifas[0];

  container.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 1rem">Registrar solicitud de alquiler</h2>
      <form id="form-solicitud">
        <div class="form-grid">
          <label class="field">
            <span>Cliente *</span>
            <input name="cliente_nombre" required placeholder="Nombre completo" />
          </label>
          <label class="field">
            <span>Telefono *</span>
            <input name="cliente_telefono" required type="tel" placeholder="300 123 4567" />
          </label>
          <label class="field field-full">
            <span>Direccion de entrega *</span>
            <input name="direccion" required placeholder="Barrio, calle, referencia" />
          </label>
          <label class="field">
            <span>Fecha de entrega *</span>
            <input name="fecha_entrega" type="date" required value="${hoy}" min="${hoy}" />
          </label>
          <label class="field">
            <span>Hora de entrega *</span>
            <input name="hora_entrega" type="time" required value="08:00" />
          </label>
          <label class="field">
            <span>Lavadora</span>
            <select name="lavadora_id" id="lavadora_id">
              <option value="">Asignar despues</option>
              ${inventario
                .map(
                  (l) =>
                    `<option value="${l.id}" data-codigo="${l.codigo}">${l.codigo} - ${l.modelo}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>Dias de alquiler *</span>
            <input name="dias_alquiler" type="number" min="1" value="1" required id="dias" />
          </label>
          <label class="field">
            <span>Tarifa</span>
            <select name="tarifa_id" id="tarifa_id">
              ${tarifas.length
                ? tarifas
                    .map(
                      (t, i) =>
                        `<option value="${t.id}" data-precio="${t.precio_dia}" ${i === 0 ? "selected" : ""}>${t.nombre} (${formatMoney(t.precio_dia)}/dia)</option>`
                    )
                    .join("")
                : `<option value="" data-precio="25000">Tarifa estandar</option>`}
            </select>
          </label>
          <label class="field">
            <span>Total estimado</span>
            <input name="total" id="total" type="number" readonly />
          </label>
          <label class="field field-full">
            <span>Notas</span>
            <textarea name="notas" rows="2" placeholder="Instrucciones especiales"></textarea>
          </label>
        </div>
        <div class="form-actions">
          <a href="#/" class="btn btn-ghost">Cancelar</a>
          <button type="submit" class="btn btn-primary">Guardar solicitud</button>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("form-solicitud");
  const diasEl = document.getElementById("dias");
  const tarifaEl = document.getElementById("tarifa_id");
  const totalEl = document.getElementById("total");

  function calcTotal() {
    const dias = Number(diasEl.value) || 1;
    const opt = tarifaEl.selectedOptions[0];
    const precio = Number(opt?.dataset.precio || tarifaDefault?.precio_dia || 25000);
    totalEl.value = dias * precio;
  }

  diasEl.addEventListener("input", calcTotal);
  tarifaEl.addEventListener("change", calcTotal);
  calcTotal();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const lavOpt = document.getElementById("lavadora_id").selectedOptions[0];
    const payload = {
      cliente_nombre: fd.get("cliente_nombre"),
      cliente_telefono: fd.get("cliente_telefono"),
      direccion: fd.get("direccion"),
      fecha_entrega: fd.get("fecha_entrega"),
      hora_entrega: fd.get("hora_entrega"),
      lavadora_id: fd.get("lavadora_id") || "",
      lavadora_codigo: lavOpt?.dataset?.codigo || "",
      dias_alquiler: Number(fd.get("dias_alquiler")),
      tarifa_id: fd.get("tarifa_id") || "",
      total: Number(fd.get("total")),
      notas: fd.get("notas") || "",
      estado: "pendiente",
    };

    try {
      await api.createSolicitud(payload);
      window.showToast?.("Solicitud registrada correctamente", "success");
      location.hash = "#/";
    } catch (err) {
      window.showToast?.(err.message, "error");
    }
  });
}
