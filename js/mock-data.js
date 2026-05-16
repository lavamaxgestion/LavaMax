/**
 * Datos locales de prueba (localStorage).
 * Se usa automaticamente cuando no hay URL del API de Google Sheets.
 */

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
        nombre: "Estandar",
        precio_dia: 25000,
        descripcion: "Alquiler por dia",
      },
      {
        id: tar2,
        nombre: "Fin de semana",
        precio_dia: 30000,
        descripcion: "Viernes a domingo",
      },
    ],
    usuarios: [
      {
        id: "usr-001",
        nombre: "Ana Operadora",
        email: "ana@lavarent.local",
        rol: "operador",
        activo: "si",
      },
      {
        id: "usr-002",
        nombre: "Carlos Repartidor",
        email: "carlos@lavarent.local",
        rol: "repartidor",
        activo: "si",
      },
      {
        id: "usr-003",
        nombre: "Maria Admin",
        email: "maria@lavarent.local",
        rol: "admin",
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
        fecha_entrega: todayStr(),
        hora_entrega: "10:00",
        lavadora_id: inv1,
        lavadora_codigo: "LAV-01",
        dias_alquiler: 2,
        tarifa_id: tar1,
        total: 50000,
        estado: "confirmada",
        notas: "Entregar en porteria",
      },
      {
        id: "sol-002",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Laura Gomez",
        cliente_telefono: "310 444 5566",
        direccion: "Kennedy, Carrera 78 #45-12",
        fecha_entrega: addDaysStr(1),
        hora_entrega: "14:30",
        lavadora_id: "",
        lavadora_codigo: "",
        dias_alquiler: 3,
        tarifa_id: tar1,
        total: 75000,
        estado: "pendiente",
        notas: "",
      },
      {
        id: "sol-003",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Pedro Ramirez",
        cliente_telefono: "320 777 8899",
        direccion: "Suba, Calle 127 #15-30",
        fecha_entrega: addDaysStr(3),
        hora_entrega: "09:00",
        lavadora_id: inv2,
        lavadora_codigo: "LAV-02",
        dias_alquiler: 1,
        tarifa_id: tar2,
        total: 30000,
        estado: "pendiente",
        notas: "Cliente pide factura",
      },
      {
        id: "sol-004",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Sofia Mendoza",
        cliente_telefono: "315 222 3344",
        direccion: "Chapinero, Calle 53 #7-88",
        fecha_entrega: addDaysStr(-2),
        hora_entrega: "11:00",
        lavadora_id: inv3,
        lavadora_codigo: "LAV-03",
        dias_alquiler: 2,
        tarifa_id: tar1,
        total: 50000,
        estado: "entregada",
        notas: "",
      },
      {
        id: "sol-005",
        fecha_solicitud: nowStr(),
        cliente_nombre: "Diego Castro",
        cliente_telefono: "301 999 0011",
        direccion: "Engativa, Av. Ciudad de Cali #100-50",
        fecha_entrega: addDaysStr(-1),
        hora_entrega: "16:00",
        lavadora_id: inv1,
        lavadora_codigo: "LAV-01",
        dias_alquiler: 1,
        tarifa_id: tar1,
        total: 25000,
        estado: "cancelada",
        notas: "Cliente cancelo por viaje",
      },
    ],
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* usar seed */
  }
  return createSeedData();
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

function buildReport(solicitudes, desde, hasta) {
  const d0 = desde ? new Date(desde + "T00:00:00") : new Date(0);
  const d1 = hasta ? new Date(hasta + "T23:59:59") : new Date();

  const filtered = solicitudes.filter((r) => {
    const fe = new Date(r.fecha_entrega + "T12:00:00");
    return fe >= d0 && fe <= d1;
  });

  let ingresos = 0;
  let entregadas = 0;
  let canceladas = 0;

  filtered.forEach((r) => {
    if (r.estado === "entregada") {
      ingresos += Number(r.total) || 0;
      entregadas++;
    }
    if (r.estado === "cancelada") canceladas++;
  });

  return {
    ingresos,
    total_solicitudes: filtered.length,
    entregadas,
    canceladas,
    detalle: filtered,
  };
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
        case "usuarios":
          return { ok: true, data: [...store.usuarios] };
        case "reportes":
          return {
            ok: true,
            data: buildReport(store.solicitudes, params.desde, params.hasta),
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
