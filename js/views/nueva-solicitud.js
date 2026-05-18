import { api, formatMoney } from "../api.js";
import { ESTADO_PAGO_DEFAULT } from "../finanzas.js";
import { horasFromTarifa } from "../alquiler.js";

function lavadoraLabel(l) {
  return `${l.codigo} - ${l.modelo}`;
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
  };
}

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
              <input type="hidden" name="lavadora_id" id="lavadora_id" value="" />
              <input type="hidden" name="lavadora_codigo" id="lavadora_codigo" value="" />
              <ul id="lavadora-listbox" class="autocomplete-list" role="listbox" hidden></ul>
            </div>
            <small class="field-hint">Opcional. Dejar vacio para asignar despues.</small>
          </label>
          <label class="field">
            <span>Periodos de alquiler *</span>
            <input name="dias_alquiler" type="number" min="1" value="1" required id="dias" />
            <small class="field-hint">Cada periodo usa la duracion de la tarifa (12h o 24h).</small>
          </label>
          <label class="field">
            <span>Tarifa (duracion)</span>
            <select name="tarifa_id" id="tarifa_id">
              ${tarifas.length
                ? tarifas
                    .map((t, i) => {
                      const horas = horasFromTarifa(t);
                      return `<option value="${t.id}" data-precio="${t.precio_dia}" data-horas="${horas}" ${i === 0 ? "selected" : ""}>${t.nombre} · ${horas}h (${formatMoney(t.precio_dia)})</option>`;
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

  setupLavadoraAutocomplete(document.getElementById("lavadora-autocomplete"), inventario);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
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
      estado: "pendiente",
      estado_pago: ESTADO_PAGO_DEFAULT,
      monto_pagado: "",
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
