/**
 * Datos locales de prueba (localStorage).
 * Se usa automaticamente cuando no hay URL del API de Google Sheets.
 */

import {
  ESTADO_PAGO_DEFAULT,
  buildReporteFinanciero,
  normalizeSolicitudPago,
} from "./finanzas.js";

const MOCK_STORAGE_KEY = "lavarent_mock_store";

function uuid() {
  return crypto.randomUUID?.() || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function createSeedData() {
  const inv1 = "inv-001";
  const inv2 = "inv-002";
  const inv3 = "inv-003";
  const tar1 = "tar-001";
  const tar2 = "tar-002";

  return {
    inventario: [
      {
        id: inv1,
        codigo: "LAV-01",
        modelo: "Samsung 18kg",
        capacidad_kg: 18,
        estado: "disponible",
      },
      {
        id: inv2,
        codigo: "LAV-02",
        modelo: "LG 22kg",
        capacidad_kg: 22,
        estado: "disponible",
      },
      {
        id: inv3,
        codigo: "LAV-03",
        modelo: "Whirlpool 16kg",
        capacidad_kg: 16,
        estado: "alquilada",
      },
    ],
    tarifas: [
      {
        id: tar1,
        nombre: "Dia completo (24h)",
        precio_dia: 25000,
        horas_duracion: 24,
        descripcion: "Entrega y recogida a las 24 horas",
      },
      {
        id: tar2,
        nombre: "Medio dia (12h)",
        precio_dia: 15000,
        horas_duracion: 12,
        descripcion: "Alquiler por 12 horas",
      },
    ],
    usuarios: [
      {
        id: "usr-001",
        nombre: "Ana Operadora",
        email: "ana@lavarent.local",
        rol: "operador",
        pin: "2222",
        activo: "si",
      },
      {
        id: "usr-002",
        nombre: "Carlos Repartidor",
        email: "carlos@lavarent.local",
        rol: "repartidor",
        pin: "3333",
        activo: "si",
      },
      {
        id: "usr-003",
        nombre: "Maria Admin",
        email: "maria@lavarent.local",
        rol: "admin",
        pin: "1111",
        activo: "si",
      },
    ],
    solicitudes: [
      {
        id: "sol-001",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Juan Perez",
        cliente_telefono: "300 111 2233",
        direccion: "Barrio Centro, Calle 10 #5-20",
        fecha_entrega: addDaysStr(-1),
        hora_entrega: "09:00",
        lavadora_id: inv1,
        lavadora_codigo: "LAV-01",
        dias_alquiler: 1,
        horas_alquiler: 24,
        tarifa_id: tar1,
        total: 25000,
        estado: "entregada",
        estado_pago: "pago pendiente",
        monto_pagado: "",
        notas: "Cobrar al recoger hoy 9am",
      },
      {
        id: "sol-002",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Laura Gomez",
        cliente_telefono: "310 444 5566",
        direccion: "Kennedy, Carrera 78 #45-12",
        fecha_entrega: addDaysStr(-1),
        hora_entrega: "14:00",
        lavadora_id: inv2,
        lavadora_codigo: "LAV-02",
        dias_alquiler: 1,
        horas_alquiler: 12,
        tarifa_id: tar2,
        total: 15000,
        estado: "entregada",
        estado_pago: "pago pendiente",
        monto_pagado: "",
        notas: "Recogida 12h - cobrar en puerta",
      },
      {
        id: "sol-003",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Pedro Ramirez",
        cliente_telefono: "320 777 8899",
        direccion: "Suba, Calle 127 #15-30",
        fecha_entrega: todayStr(),
        hora_entrega: "08:00",
        lavadora_id: inv3,
        lavadora_codigo: "LAV-03",
        dias_alquiler: 1,
        horas_alquiler: 24,
        tarifa_id: tar1,
        total: 25000,
        estado: "entregada",
        estado_pago: "pago parcial",
        monto_pagado: 10000,
        notas: "Abono al entregar; saldo al recoger",
      },
      {
        id: "sol-004",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Sofia Mendoza",
        cliente_telefono: "315 222 3344",
        direccion: "Chapinero, Calle 53 #7-88",
        fecha_entrega: todayStr(),
        hora_entrega: "10:00",
        lavadora_id: inv1,
        lavadora_codigo: "LAV-01",
        dias_alquiler: 1,
        horas_alquiler: 12,
        tarifa_id: tar2,
        total: 15000,
        estado: "confirmada",
        estado_pago: "pago pendiente",
        monto_pagado: "",
        notas: "Entrega confirmada; recogida hoy 10pm",
      },
      {
        id: "sol-005",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Diego Castro",
        cliente_telefono: "301 999 0011",
        direccion: "Engativa, Av. Ciudad de Cali #100-50",
        fecha_entrega: addDaysStr(-2),
        hora_entrega: "11:00",
        lavadora_id: inv2,
        lavadora_codigo: "LAV-02",
        dias_alquiler: 1,
        horas_alquiler: 24,
        tarifa_id: tar1,
        total: 25000,
        estado: "recogida",
        estado_pago: "pago efectivo",
        monto_pagado: "",
        notas: "Ya cobrado en recogida",
      },
      {
        id: "sol-006",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Ana Ruiz",
        cliente_telefono: "318 555 6677",
        direccion: "Teusaquillo, Carrera 45 #12-8",
        fecha_entrega: addDaysStr(1),
        hora_entrega: "15:00",
        lavadora_id: "",
        lavadora_codigo: "",
        dias_alquiler: 1,
        horas_alquiler: 24,
        tarifa_id: tar1,
        total: 25000,
        estado: "pendiente",
        estado_pago: "pago pendiente",
        monto_pagado: "",
        notas: "Aun no entregada",
      },
      {
        id: "sol-007",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Luis Vargas",
        cliente_telefono: "312 888 9900",
        direccion: "Fontibon, Calle 20 #68-40",
        fecha_entrega: addDaysStr(-1),
        hora_entrega: "16:00",
        lavadora_id: inv3,
        lavadora_codigo: "LAV-03",
        dias_alquiler: 1,
        horas_alquiler: 24,
        tarifa_id: tar1,
        total: 25000,
        estado: "cancelada",
        estado_pago: "pago pendiente",
        monto_pagado: "",
        notas: "Cliente cancelo",
      },
    ],
  };
}

const DEFAULT_PINS = { admin: "1111", operador: "2222", repartidor: "3333" };

function migrateStore(store) {
  store.solicitudes?.forEach((s) => normalizeSolicitudPago(s));
  store.usuarios?.forEach((u) => {
    if (!u.pin && u.rol && DEFAULT_PINS[u.rol]) {
      u.pin = DEFAULT_PINS[u.rol];
    }
  });
  return store;
}

function loadStore() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const pinsBefore = JSON.stringify(parsed.usuarios?.map((u) => u.pin));
      const store = migrateStore(parsed);
      if (JSON.stringify(store.usuarios?.map((u) => u.pin)) !== pinsBefore) {
        saveStore(store);
      }
      return store;
    }
  } catch {
    /* usar seed */
  }
  return migrateStore(createSeedData());
}

function saveStore(store) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(store));
}

export function resetMockData() {
  localStorage.removeItem(MOCK_STORAGE_KEY);
  return createSeedData();
}

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function upsert(collection, payload) {
  const idx = collection.findIndex((r) => r.id === payload.id);
  if (idx >= 0) {
    collection[idx] = { ...collection[idx], ...payload };
    return collection[idx];
  }
  const row = { id: payload.id || uuid(), ...payload };
  if (!row.id) row.id = uuid();
  collection.push(row);
  return row;
}

function removeById(collection, id) {
  const idx = collection.findIndex((r) => String(r.id) === String(id));
  if (idx < 0) throw new Error("Registro no encontrado");
  collection.splice(idx, 1);
  return { ok: true };
}

/**
 * Misma firma logica que el API remoto: { ok, data } o { ok: false, error }
 */
export async function mockRequest(method, params = {}, body = null) {
  await delay();

  const store = loadStore();
  const resource = params.resource;

  try {
    if (method === "GET") {
      switch (resource) {
        case "solicitudes":
          return { ok: true, data: [...store.solicitudes] };
        case "inventario":
          return { ok: true, data: [...store.inventario] };
        case "tarifas":
          return { ok: true, data: [...store.tarifas] };
        case "auth": {
          const pin = params.pin;
          if (!pin) throw new Error("Ingresa tu PIN");
          const user = store.usuarios.find(
            (u) =>
              String(u.pin) === String(pin) &&
              String(u.activo || "").toLowerCase() === "si"
          );
          if (!user) throw new Error("PIN incorrecto o usuario inactivo");
          return {
            ok: true,
            data: {
              id: user.id,
              nombre: user.nombre,
              email: user.email,
              rol: user.rol,
            },
          };
        }
        case "usuarios":
          return { ok: true, data: [...store.usuarios] };
        case "reportes":
          return {
            ok: true,
            data: buildReporteFinanciero(store.solicitudes, params.desde, params.hasta),
          };
        default:
          throw new Error("Recurso no encontrado");
      }
    }

    if (method === "POST") {
      switch (resource) {
        case "solicitudes": {
          if (params.id) {
            const idx = store.solicitudes.findIndex(
              (r) => String(r.id) === String(params.id)
            );
            if (idx < 0) throw new Error("Registro no encontrado");
            store.solicitudes[idx] = { ...store.solicitudes[idx], ...body };
            saveStore(store);
            return { ok: true, data: store.solicitudes[idx] };
          }
          const row = {
            id: uuid(),
            fecha_solicitud: nowStr(),
            estado: "pendiente",
            estado_pago: ESTADO_PAGO_DEFAULT,
            monto_pagado: "",
            horas_alquiler: body.horas_alquiler || (Number(body.dias_alquiler) || 1) * 24,
            ...body,
          };
          store.solicitudes.push(row);
          saveStore(store);
          return { ok: true, data: row };
        }
        case "inventario": {
          if (params.action === "delete") {
            removeById(store.inventario, params.id);
            saveStore(store);
            return { ok: true };
          }
          const saved = upsert(store.inventario, body);
          saveStore(store);
          return { ok: true, data: saved };
        }
        case "tarifas": {
          if (params.action === "delete") {
            removeById(store.tarifas, params.id);
            saveStore(store);
            return { ok: true };
          }
          const saved = upsert(store.tarifas, body);
          saveStore(store);
          return { ok: true, data: saved };
        }
        case "usuarios": {
          if (params.action === "delete") {
            removeById(store.usuarios, params.id);
            saveStore(store);
            return { ok: true };
          }
          const saved = upsert(store.usuarios, body);
          saveStore(store);
          return { ok: true, data: saved };
        }
        default:
          throw new Error("Recurso no encontrado");
      }
    }

    throw new Error("Metodo no soportado");
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
