/**
 * LavaRent - API Google Sheets
 * 1. Crea una hoja de calculo con las pestanas: Solicitudes, Inventario, Tarifas, Usuarios
 * 2. Extensiones > Apps Script > pega este codigo
 * 3. Configura ADMIN_KEY y despliega como Web App (cualquiera)
 */

const ADMIN_KEY = "cambia-esta-clave-secreta";

const SHEETS = {
  solicitudes: "Solicitudes",
  inventario: "Inventario",
  tarifas: "Tarifas",
  usuarios: "Usuarios",
};

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, httpMethod) {
  try {
    const p = e.parameter || {};
    const method = p._method || httpMethod;
    const resource = p.resource;

    if (method === "POST" && e.postData && e.postData.contents) {
      const body = JSON.parse(e.postData.contents);
      return jsonResponse(routePost(resource, p, body));
    }

    return jsonResponse(routeGet(resource, p));
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function routeGet(resource, p) {
  switch (resource) {
    case "solicitudes":
      return { ok: true, data: listRows(SHEETS.solicitudes) };
    case "inventario":
      return { ok: true, data: listRows(SHEETS.inventario) };
    case "tarifas":
      return { ok: true, data: listRows(SHEETS.tarifas) };
    case "auth":
      return loginByPin(p.pin);
    case "usuarios":
      requireAdmin(p);
      return { ok: true, data: listRows(SHEETS.usuarios) };
    case "reportes":
      requireAdmin(p);
      return { ok: true, data: buildReport(p.desde, p.hasta) };
    default:
      throw new Error("Recurso no encontrado");
  }
}

function routePost(resource, p, body) {
  switch (resource) {
    case "solicitudes":
      if (p.id) return { ok: true, data: updateRow(SHEETS.solicitudes, p.id, body) };
      return { ok: true, data: appendRow(SHEETS.solicitudes, body) };
    case "inventario":
      requireAdmin(p);
      if (p.action === "delete") return deleteRow(SHEETS.inventario, p.id);
      return { ok: true, data: upsertRow(SHEETS.inventario, body) };
    case "tarifas":
      requireAdmin(p);
      if (p.action === "delete") return deleteRow(SHEETS.tarifas, p.id);
      return { ok: true, data: upsertRow(SHEETS.tarifas, body) };
    case "usuarios":
      requireAdmin(p);
      if (p.action === "delete") return deleteRow(SHEETS.usuarios, p.id);
      return { ok: true, data: upsertRow(SHEETS.usuarios, body) };
    default:
      throw new Error("Recurso no encontrado");
  }
}

function requireAdmin(p) {
  if (!ADMIN_KEY || p.adminKey !== ADMIN_KEY) {
    throw new Error("Clave de administrador invalida");
  }
}

function loginByPin(pin) {
  if (!pin) throw new Error("Ingresa tu PIN");
  const users = listRows(SHEETS.usuarios);
  const user = users.find(function (u) {
    return (
      String(u.pin) === String(pin) &&
      String(u.activo || "").toLowerCase() === "si"
    );
  });
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

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    initHeaders(name, sh);
  }
  return sh;
}

function initHeaders(name, sh) {
  const headers = {
    Solicitudes: [
      "id",
      "fecha_solicitud",
      "cliente_nombre",
      "cliente_telefono",
      "direccion",
      "fecha_entrega",
      "hora_entrega",
      "lavadora_id",
      "lavadora_codigo",
      "dias_alquiler",
      "horas_alquiler",
      "tarifa_id",
      "total",
      "estado",
      "estado_pago",
      "monto_pagado",
      "notas",
    ],
    Inventario: ["id", "codigo", "modelo", "capacidad_kg", "estado"],
    Tarifas: ["id", "nombre", "precio_dia", "horas_duracion", "descripcion"],
    Usuarios: ["id", "nombre", "email", "rol", "pin", "activo"],
  };
  const row = headers[name];
  if (row) sh.getRange(1, 1, 1, row.length).setValues([row]);
}

function serializeCell(header, value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date) {
    const tz = Session.getScriptTimeZone();
    if (header === "fecha_entrega" || header === "fecha_solicitud") {
      return Utilities.formatDate(value, tz, "yyyy-MM-dd");
    }
    if (header === "hora_entrega") {
      return Utilities.formatDate(value, tz, "HH:mm");
    }
    return Utilities.formatDate(value, tz, "yyyy-MM-dd HH:mm:ss");
  }

  return value;
}

function listRows(sheetName) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      obj[h] = serializeCell(h, row[i]);
    });
    return obj;
  });
}

function appendRow(sheetName, data) {
  const sh = getSheet(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const id = Utilities.getUuid();
  const now = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
  const row = {};
  headers.forEach(function (h) {
    row[h] = data[h] !== undefined ? data[h] : "";
  });
  if (!row.id) row.id = id;
  if (sheetName === SHEETS.solicitudes && !row.fecha_solicitud) {
    row.fecha_solicitud = now;
  }
  if (sheetName === SHEETS.solicitudes && !row.estado) {
    row.estado = "pendiente";
  }
  if (sheetName === SHEETS.solicitudes && !row.estado_pago) {
    row.estado_pago = "pago pendiente";
  }
  if (sheetName === SHEETS.solicitudes && row.monto_pagado === undefined) {
    row.monto_pagado = "";
  }
  const arr = headers.map(function (h) {
    return row[h];
  });
  sh.appendRow(arr);
  return row;
}

function updateRow(sheetName, id, data) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("id");
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      headers.forEach(function (h, c) {
        if (data[h] !== undefined) values[r][c] = data[h];
      });
      sh.getRange(r + 1, 1, 1, headers.length).setValues([values[r]]);
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = values[r][i];
      });
      return obj;
    }
  }
  throw new Error("Registro no encontrado");
}

function upsertRow(sheetName, data) {
  if (data.id) {
    try {
      return updateRow(sheetName, data.id, data);
    } catch (e) {
      /* crear si no existe */
    }
  }
  return appendRow(sheetName, data);
}

function deleteRow(sheetName, id) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  const idCol = values[0].indexOf("id");
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      sh.deleteRow(r + 1);
      return { ok: true };
    }
  }
  throw new Error("Registro no encontrado");
}

function montoCobrado(r) {
  var total = Number(r.total) || 0;
  var ep = r.estado_pago || "pago pendiente";
  if (ep === "pago efectivo" || ep === "pago transferencia") return total;
  if (ep === "pago parcial") {
    var pagado = Number(r.monto_pagado) || 0;
    return Math.min(Math.max(0, pagado), total);
  }
  return 0;
}

function saldoPendiente(r) {
  var total = Number(r.total) || 0;
  return Math.max(0, total - montoCobrado(r));
}

function buildReport(desde, hasta) {
  const rows = listRows(SHEETS.solicitudes);
  const d0 = desde ? new Date(desde + "T00:00:00") : new Date(0);
  const d1 = hasta ? new Date(hasta + "T23:59:59") : new Date();

  const filtered = rows.filter(function (r) {
    const fe = new Date(r.fecha_entrega + "T12:00:00");
    return fe >= d0 && fe <= d1;
  });

  var ingresos_cobrados = 0;
  var por_cobrar = 0;
  var entregadas = 0;
  var canceladas = 0;
  var pendientes_pago = 0;
  var pagos_efectivo = 0;
  var pagos_transferencia = 0;
  var pagos_parciales = 0;

  var detalle = filtered.filter(function (r) {
    return r.estado !== "cancelada";
  });
  var detalle_canceladas = filtered.filter(function (r) {
    return r.estado === "cancelada";
  });

  detalle.forEach(function (r) {
    if (r.estado === "entregada") entregadas++;

    var ep = r.estado_pago || "pago pendiente";
    ingresos_cobrados += montoCobrado(r);
    por_cobrar += saldoPendiente(r);

    if (ep === "pago pendiente") pendientes_pago++;
    if (ep === "pago efectivo") pagos_efectivo++;
    if (ep === "pago transferencia") pagos_transferencia++;
    if (ep === "pago parcial") pagos_parciales++;
  });

  canceladas = detalle_canceladas.length;

  return {
    ingresos_cobrados: ingresos_cobrados,
    por_cobrar: por_cobrar,
    ingresos: ingresos_cobrados,
    total_solicitudes: filtered.length,
    entregadas: entregadas,
    canceladas: canceladas,
    pendientes_pago: pendientes_pago,
    pagos_efectivo: pagos_efectivo,
    pagos_transferencia: pagos_transferencia,
    pagos_parciales: pagos_parciales,
    detalle: detalle,
    detalle_canceladas: detalle_canceladas,
  };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
