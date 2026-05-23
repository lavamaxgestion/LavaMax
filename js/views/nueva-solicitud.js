import { api, formatMoney } from "../api.js";
import { ESTADO_PAGO_DEFAULT, normalizeSolicitudPago } from "../finanzas.js";
import {
  getHorasAlquiler,
  horasFromTarifa,
  normalizeSolicitudAlquiler,
} from "../alquiler.js";
import { puedeEditarGestionEnOrdenes } from "../estados.js";

function getEditIdFromHash() {
  const hash = location.hash.replace("#", "") || "/";
  const q = hash.indexOf("?");
  if (q < 0) return null;
  return new URLSearchParams(hash.slice(q + 1)).get("id");
}

function lavadoraLabel(l) {
  return `${l.codigo} - ${l.modelo}`;
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function periodosFromSolicitud(solicitud, tarifas) {
  const tarifa = tarifas.find((t) => String(t.id) === String(solicitud.tarifa_id));
  const horasPorPeriodo = horasFromTarifa(tarifa);
  return Math.max(1, Math.round(getHorasAlquiler(solicitud) / horasPorPeriodo));
}

function inventarioParaFormulario(todos, solicitud, isEdit) {
  const disponibles = (todos || []).filter((i) => i.estado === "disponible");
  if (!isEdit || !solicitud?.lavadora_id) return disponibles;
  const asignada = (todos || []).find((i) => String(i.id) === String(solicitud.lavadora_id));
  if (asignada && !disponibles.some((i) => String(i.id) === String(asignada.id))) {
    return [asignada, ...disponibles];
  }
  return disponibles;
}

function setupLavadoraAutocomplete(wrap, inventario) {
  const input = wrap.querySelector("#lavadora_search");
  const hiddenId = wrap.querySelector("#lavadora_id");
  const hiddenCodigo = wrap.querySelector("#lavadora_codigo");
  const list = wrap.querySelector("#lavadora-listbox");

  let activeIndex = -1;
  let selected = null;

  function filterItems(query) {
    const q = query.trim().toLowerCase();
    if (!q) return inventario;
    return inventario.filter(
      (l) =>
        l.codigo.toLowerCase().includes(q) ||
        l.modelo.toLowerCase().includes(q) ||
        lavadoraLabel(l).toLowerCase().includes(q)
    );
  }

  function setSelected(item) {
    selected = item;
    hiddenId.value = item?.id || "";
    hiddenCodigo.value = item?.codigo || "";
    input.value = item ? lavadoraLabel(item) : "";
    closeList();
  }

  function renderList(items) {
    list.innerHTML = "";
    activeIndex = -1;

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "autocomplete-empty";
      empty.setAttribute("role", "option");
      empty.textContent = input.value.trim()
        ? "Sin coincidencias en inventario disponible"
        : "No hay lavadoras disponibles";
      list.appendChild(empty);
      openList();
      return;
    }

    items.forEach((item, i) => {
      const li = document.createElement("li");
      li.className = "autocomplete-item";
      li.setAttribute("role", "option");
      li.id = `lavadora-opt-${i}`;
      li.textContent = lavadoraLabel(item);
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        setSelected(item);
      });
      list.appendChild(li);
    });
    openList();
  }

  function highlight(index) {
    const items = list.querySelectorAll(".autocomplete-item");
    items.forEach((el, i) => {
      el.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    activeIndex = index;
    if (index >= 0 && items[index]) {
      items[index].scrollIntoView({ block: "nearest" });
    }
  }

  function openList() {
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function closeList() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    highlight(-1);
  }

  function showMatches() {
    renderList(filterItems(input.value));
  }

  input.addEventListener("input", () => {
    if (selected && input.value !== lavadoraLabel(selected)) {
      selected = null;
      hiddenId.value = "";
      hiddenCodigo.value = "";
    }
    showMatches();
  });

  input.addEventListener("focus", showMatches);

  input.addEventListener("blur", () => {
    setTimeout(() => {
      closeList();
      if (!selected && input.value.trim()) {
        const match = filterItems(input.value);
        if (match.length === 1) setSelected(match[0]);
        else input.value = "";
      }
    }, 150);
  });

  input.addEventListener("keydown", (e) => {
    const items = list.querySelectorAll(".autocomplete-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.hidden) showMatches();
      highlight(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlight(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter" && !list.hidden && activeIndex >= 0 && items[activeIndex]) {
      e.preventDefault();
      const matches = filterItems(input.value);
      setSelected(matches[activeIndex]);
    } else if (e.key === "Escape") {
      closeList();
    }
  });

  return {
    getSelected: () => selected,
    setSelected,
  };
}

export async function renderNuevaSolicitud(container, topbar) {
  topbar.innerHTML = "";

  const editId = getEditIdFromHash();
  const isEdit = Boolean(editId);

  container.innerHTML = `<div class="loading"><span class="spinner"></span> Cargando formulario...</div>`;

  let inventarioAll = [];
  let tarifas = [];
  let solicitud = null;

  try {
    const [invRes, tarRes, solRes] = await Promise.all([
      api.getInventario().catch(() => ({ data: [] })),
      api.getTarifas().catch(() => ({ data: [] })),
      isEdit ? api.getSolicitudes().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]);
    inventarioAll = invRes.data || [];
    tarifas = tarRes.data || [];

    if (isEdit) {
      solicitud = (solRes.data || [])
        .map((s) => normalizeSolicitudPago(normalizeSolicitudAlquiler({ ...s })))
        .find((s) => String(s.id) === String(editId));
      if (!solicitud) {
        container.innerHTML = `
          <div class="card empty">
            <strong>Solicitud no encontrada</strong>
            <p>No existe una orden con id "${escapeAttr(editId)}".</p>
            <p><a href="#/" class="btn btn-primary">Volver a ordenes</a></p>
          </div>`;
        return;
      }
      if (!puedeEditarGestionEnOrdenes(solicitud.estado)) {
        container.innerHTML = `
          <div class="card empty">
            <strong>No se puede editar esta solicitud</strong>
            <p>Solo se editan ordenes en estado <em>pendiente</em> o <em>confirmada</em>.</p>
            <p>Estado actual: <strong>${escapeAttr(solicitud.estado)}</strong></p>
            <p><a href="#/" class="btn btn-primary">Volver a ordenes</a></p>
          </div>`;
        return;
      }
    }
  } catch (err) {
    container.innerHTML = `
      <div class="card empty">
        <strong>Error al cargar el formulario</strong>
        <p>${escapeAttr(err.message)}</p>
        <p><a href="#/" class="btn btn-ghost">Volver a ordenes</a></p>
      </div>`;
    return;
  }

  const inventario = inventarioParaFormulario(inventarioAll, solicitud, isEdit);
  const hoy = new Date().toISOString().slice(0, 10);
  const tarifaDefault = tarifas[0];
  const periodos = solicitud ? periodosFromSolicitud(solicitud, tarifas) : 1;

  const v = {
    cliente_nombre: solicitud?.cliente_nombre || "",
    cliente_telefono: solicitud?.cliente_telefono || "",
    direccion: solicitud?.direccion || "",
    fecha_entrega: solicitud?.fecha_entrega || hoy,
    hora_entrega: solicitud?.hora_entrega || "08:00",
    dias_alquiler: periodos,
    tarifa_id: solicitud?.tarifa_id || tarifaDefault?.id || "",
    notas: solicitud?.notas || "",
    total: solicitud?.total ?? "",
  };

  container.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 0.35rem">${isEdit ? "Editar solicitud" : "Registrar solicitud de alquiler"}</h2>
      ${
        isEdit
          ? `<p class="hint" style="margin:0 0 1rem">Orden <strong>${escapeAttr(solicitud.estado)}</strong> · los cambios de entrega o recogida se hacen en Entregas o Pagos.</p>`
          : ""
      }
      <form id="form-solicitud">
        ${isEdit ? `<input type="hidden" name="id" id="solicitud-id" value="${escapeAttr(editId)}" />` : ""}
        <div class="form-grid">
          <label class="field">
            <span>Cliente *</span>
            <input name="cliente_nombre" required placeholder="Nombre completo" value="${escapeAttr(v.cliente_nombre)}" />
          </label>
          <label class="field">
            <span>Telefono *</span>
            <input name="cliente_telefono" required type="tel" placeholder="300 123 4567" value="${escapeAttr(v.cliente_telefono)}" />
          </label>
          <label class="field field-full">
            <span>Direccion de entrega *</span>
            <input name="direccion" required placeholder="Barrio, calle, referencia" value="${escapeAttr(v.direccion)}" />
          </label>
          <label class="field">
            <span>Fecha de entrega *</span>
            <input name="fecha_entrega" type="date" required value="${escapeAttr(v.fecha_entrega)}" />
          </label>
          <label class="field">
            <span>Hora de entrega *</span>
            <input name="hora_entrega" type="time" required value="${escapeAttr(v.hora_entrega)}" />
          </label>
          <label class="field">
            <span>Lavadora</span>
            <div class="autocomplete" id="lavadora-autocomplete">
              <input
                type="text"
                id="lavadora_search"
                placeholder="Buscar por codigo o modelo"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="false"
                aria-controls="lavadora-listbox"
              />
              <input type="hidden" name="lavadora_id" id="lavadora_id" value="${escapeAttr(solicitud?.lavadora_id || "")}" />
              <input type="hidden" name="lavadora_codigo" id="lavadora_codigo" value="${escapeAttr(solicitud?.lavadora_codigo || "")}" />
              <ul id="lavadora-listbox" class="autocomplete-list" role="listbox" hidden></ul>
            </div>
            <small class="field-hint">Opcional. Dejar vacio para asignar despues.</small>
          </label>
          <label class="field">
            <span>Periodos de alquiler *</span>
            <input name="dias_alquiler" type="number" min="1" value="${v.dias_alquiler}" required id="dias" />
            <small class="field-hint">Cada periodo usa la duracion de la tarifa (12h o 24h).</small>
          </label>
          <label class="field">
            <span>Tarifa (duracion)</span>
            <select name="tarifa_id" id="tarifa_id">
              ${tarifas.length
                ? tarifas
                    .map((t) => {
                      const horas = horasFromTarifa(t);
                      const sel = String(t.id) === String(v.tarifa_id) ? "selected" : "";
                      return `<option value="${t.id}" data-precio="${t.precio_dia}" data-horas="${horas}" ${sel}>${t.nombre} · ${horas}h (${formatMoney(t.precio_dia)})</option>`;
                    })
                    .join("")
                : `<option value="" data-precio="25000" data-horas="24">Tarifa estandar 24h</option>`}
            </select>
          </label>
          <label class="field">
            <span>Duracion total</span>
            <input id="horas-total" type="text" readonly />
            <input type="hidden" name="horas_alquiler" id="horas_alquiler" />
          </label>
          <label class="field">
            <span>Total estimado</span>
            <input name="total" id="total" type="number" readonly value="${escapeAttr(v.total)}" />
          </label>
          <label class="field field-full">
            <span>Notas</span>
            <textarea name="notas" rows="2" placeholder="Instrucciones especiales">${escapeAttr(v.notas)}</textarea>
          </label>
        </div>
        <div class="form-actions">
          <a href="#/" class="btn btn-ghost">Cancelar</a>
          <button type="submit" id="btn-guardar-solicitud" class="btn btn-primary">${isEdit ? "Guardar cambios" : "Guardar solicitud"}</button>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("form-solicitud");
  const submitBtn = document.getElementById("btn-guardar-solicitud");
  const submitLabel = submitBtn?.textContent || "Guardar solicitud";
  const diasEl = document.getElementById("dias");
  const tarifaEl = document.getElementById("tarifa_id");
  const totalEl = document.getElementById("total");
  const horasTotalEl = document.getElementById("horas-total");
  const horasAlquilerEl = document.getElementById("horas_alquiler");

  function calcTotal() {
    const periodos = Number(diasEl.value) || 1;
    const opt = tarifaEl.selectedOptions[0];
    const precio = Number(opt?.dataset.precio || tarifaDefault?.precio_dia || 25000);
    const horasPorPeriodo = Number(opt?.dataset.horas || horasFromTarifa(tarifaDefault));
    const horasTotal = periodos * horasPorPeriodo;
    totalEl.value = periodos * precio;
    horasAlquilerEl.value = horasTotal;
    horasTotalEl.value =
      horasPorPeriodo === 12
        ? `${horasTotal} horas (${periodos} x 12h)`
        : `${horasTotal} horas (${periodos} dia(s))`;
  }

  diasEl.addEventListener("input", calcTotal);
  tarifaEl.addEventListener("change", calcTotal);
  calcTotal();

  const lavadoraAc = setupLavadoraAutocomplete(
    document.getElementById("lavadora-autocomplete"),
    inventario
  );

  if (solicitud?.lavadora_id) {
    const lav = inventario.find((l) => String(l.id) === String(solicitud.lavadora_id));
    if (lav) lavadoraAc.setSelected(lav);
    else if (solicitud.lavadora_codigo) {
      document.getElementById("lavadora_search").value = solicitud.lavadora_codigo;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn?.disabled) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando...";
    }

    const fd = new FormData(form);
    const payload = {
      cliente_nombre: fd.get("cliente_nombre"),
      cliente_telefono: fd.get("cliente_telefono"),
      direccion: fd.get("direccion"),
      fecha_entrega: fd.get("fecha_entrega"),
      hora_entrega: fd.get("hora_entrega"),
      lavadora_id: fd.get("lavadora_id") || "",
      lavadora_codigo: fd.get("lavadora_codigo") || "",
      dias_alquiler: Number(fd.get("dias_alquiler")),
      horas_alquiler: Number(fd.get("horas_alquiler")) || 24,
      tarifa_id: fd.get("tarifa_id") || "",
      total: Number(fd.get("total")),
      notas: fd.get("notas") || "",
    };

    try {
      if (isEdit) {
        await api.updateSolicitud(editId, {
          ...payload,
          estado: solicitud.estado,
          estado_pago: solicitud.estado_pago || ESTADO_PAGO_DEFAULT,
          monto_pagado: solicitud.monto_pagado ?? "",
        });
        window.showToast?.("Solicitud actualizada", "success");
      } else {
        await api.createSolicitud({
          ...payload,
          estado: "pendiente",
          estado_pago: ESTADO_PAGO_DEFAULT,
          monto_pagado: "",
        });
        window.showToast?.("Solicitud registrada correctamente", "success");
      }
      location.hash = "#/";
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
      window.showToast?.(err.message, "error");
    }
  });
}
