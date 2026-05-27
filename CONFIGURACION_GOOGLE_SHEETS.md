# Configuración de Google Sheets + LavaMax

Guía paso a paso para crear la hoja de cálculo, desplegar el API y conectarla a la aplicación.

---

## Resumen

```
Tu navegador (LavaMax)
    → URL del Web App (/exec)
        → Google Apps Script (Code.gs)
            → Google Sheets (4 pestañas)
```

---

## Paso 1: Crear la hoja de cálculo

1. Entra a [Google Drive](https://drive.google.com).
2. **Nuevo → Hojas de cálculo de Google → Hoja de cálculo en blanco**.
3. Nombra el archivo, por ejemplo: `LavaMax - Datos`.
4. Crea **exactamente 4 pestañas** (pestañas inferiores). Los nombres deben coincidir **tal cual** (mayúscula inicial):

| Pestaña | Nombre exacto |
|---------|---------------|
| 1 | `Solicitudes` |
| 2 | `Inventario` |
| 3 | `Tarifas` |
| 4 | `Usuarios` |

> Si el script no encuentra una pestaña, la crea automáticamente con encabezados. Igual conviene crearlas tú para revisar columnas.

---

## Paso 2: Encabezados de cada pestaña (fila 1)

Copia cada fila en la **fila 1** de su pestaña. La fila 1 es siempre los nombres de columna; los datos empiezan en la fila 2.

### Pestaña `Solicitudes`

```
id | fecha_solicitud | cliente_nombre | cliente_telefono | direccion | fecha_entrega | hora_entrega | lavadora_id | lavadora_codigo | dias_alquiler | horas_alquiler | tarifa_id | total | estado | estado_pago | monto_pagado | fecha_pago | notas
```

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `id` | Identificador único | `sol-001` |
| `fecha_solicitud` | Cuándo se registró | `2026-05-18 10:30:00` |
| `cliente_nombre` | Nombre del cliente | `Juan Perez` |
| `cliente_telefono` | Teléfono | `300 123 4567` |
| `direccion` | Dirección de entrega | `Barrio Centro, Calle 10` |
| `fecha_entrega` | Fecha de entrega | `2026-05-20` |
| `hora_entrega` | Hora de entrega | `09:00` |
| `lavadora_id` | ID en inventario | `inv-001` |
| `lavadora_codigo` | Código visible | `LAV-01` |
| `dias_alquiler` | Periodos de alquiler | `1` |
| `horas_alquiler` | Horas totales | `24` |
| `tarifa_id` | ID de tarifa | `tar-001` |
| `total` | Valor en COP | `25000` |
| `estado` | Gestión | `pendiente`, `confirmada`, `entregada`, `recogida`, `cancelada` |
| `estado_pago` | Pago | `pago pendiente`, `pago efectivo`, `pago transferencia`, `pago parcial` |
| `monto_pagado` | Abono si es parcial | `10000` o vacío |
| `fecha_pago` | Fecha del cobro (`YYYY-MM-DD`); la app la llena al registrar pago | `2026-05-27` |
| `notas` | Observaciones | Texto libre |

### Pestaña `Inventario`

```
id | codigo | modelo | capacidad_kg | estado
```

| Columna | Valores típicos |
|---------|-----------------|
| `estado` | `disponible`, `alquilada`, `mantenimiento` |

**Ejemplo fila 2:**

| id | codigo | modelo | capacidad_kg | estado |
|----|--------|--------|--------------|--------|
| inv-001 | LAV-01 | Samsung 18kg | 18 | disponible |
| inv-002 | LAV-02 | LG 22kg | 22 | disponible |

### Pestaña `Tarifas`

```
id | nombre | precio_dia | horas_duracion | descripcion
```

| Columna | Notas |
|---------|-------|
| `horas_duracion` | `12` o `24` |
| `precio_dia` | Precio del periodo en COP |

**Ejemplo fila 2:**

| id | nombre | precio_dia | horas_duracion | descripcion |
|----|--------|------------|----------------|-------------|
| tar-001 | Dia completo (24h) | 25000 | 24 | Entrega y recogida a las 24h |
| tar-002 | Medio dia (12h) | 15000 | 12 | Alquiler por 12 horas |

### Pestaña `Usuarios`

```
id | nombre | email | rol | pin | activo
```

| Columna | Valores |
|---------|---------|
| `rol` | `admin`, `operador`, `repartidor` |
| `pin` | 4 a 6 dígitos |
| `activo` | `si` o `no` |

**Ejemplo fila 2 (cambia los PIN en producción):**

| id | nombre | email | rol | pin | activo |
|----|--------|-------|-----|-----|--------|
| usr-001 | Maria Admin | maria@tudominio.com | admin | 1111 | si |
| usr-002 | Ana Operadora | ana@tudominio.com | operador | 2222 | si |
| usr-003 | Carlos Repartidor | carlos@tudominio.com | repartidor | 3333 | si |

---

## Paso 3: Vincular Apps Script a la hoja

1. Con la hoja abierta: menú **Extensiones → Apps Script**.
2. Se abre el editor. Borra el código de ejemplo (`function myFunction...`).
3. Abre en tu proyecto el archivo `google-apps-script/Code.gs` y **copia todo el contenido**.
4. Pégalo en el editor de Apps Script.
5. **Guarda** (icono disco o Ctrl/Cmd + S). Nombre sugerido del proyecto: `LavaMax API`.

### Configurar la clave de administrador

En la línea 8 del script:

```javascript
const ADMIN_KEY = "cambia-esta-clave-secreta";
```

Cámbiala por una clave larga que solo tú conozcas, por ejemplo:

```javascript
const ADMIN_KEY = "MiClaveSegura2026-LavaMax";
```

Esa misma clave la usarás después en la app (botón **API**). Sin ella no funcionan inventario, tarifas, usuarios ni reportes.

---

## Paso 4: Desplegar como aplicación web

1. En Apps Script: **Implementar → Nueva implementación**.
2. Engranaje junto a **Seleccionar tipo** → elige **Aplicación web**.
3. Configura:

| Campo | Valor |
|-------|--------|
| Descripción | `LavaMax API v1` (opcional) |
| Ejecutar como | **Yo** (tu cuenta de Google) |
| Quién tiene acceso | **Cualquiera** |

> **Cualquiera** es necesario para que la app en el navegador pueda llamar al API (CORS). La seguridad la dan el PIN de usuarios y la `ADMIN_KEY`.

4. Clic en **Implementar**.
5. La primera vez Google pedirá **autorizar** la app:
   - Cuenta de Google → **Avanzado** → ir al proyecto (no es seguro) → **Permitir**.
6. Copia la **URL de la aplicación web**. Debe terminar en `/exec`, por ejemplo:

```
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
```

Guárdala en un lugar seguro.

### Si cambias el código después

**Implementar → Administrar implementaciones → lápiz → Nueva versión → Implementar.**  
Si no creas nueva versión, la URL sigue sirviendo código viejo.

---

## Paso 5: Probar el API en el navegador

Sustituye `TU_URL` y `TU_CLAVE` por los tuyos.

**Login (debe devolver JSON con `ok: true`):**

```
TU_URL?resource=auth&pin=1111
```

**Solicitudes (lista):**

```
TU_URL?resource=solicitudes
```

**Inventario (requiere clave admin):**

```
TU_URL?resource=inventario&adminKey=TU_CLAVE
```

Si ves `{"ok":true,"data":[...]}` el API responde bien. Si ves `ok:false`, lee el mensaje en `error`.

---

## Paso 6: Conectar la app LavaMax

### En local

```bash
cd gestion-lavadoras
npx serve .
```

Abre `http://localhost:8080`.

### En la aplicación

1. Inicia sesión con PIN de un usuario **admin** (ej. `1111` si usaste los datos de ejemplo).
2. Menú lateral → botón **API**.
3. Completa:
   - **URL del API:** la URL `/exec` del paso 4.
   - **Clave admin:** la misma que `ADMIN_KEY` en el script.
4. **Guardar**.
5. Deberías ver un toast de confirmación. El banner **Modo prueba** desaparece si la URL quedó guardada.

### Comprobar que usa Sheets

1. Ve a **Órdenes** o **Inventario** (admin).
2. Crea o edita un registro en la app.
3. Revisa la pestaña correspondiente en Google Sheets: debe aparecer o actualizarse la fila.

---

## Paso 7: Publicar en GitHub Pages (opcional)

1. Sube el proyecto a GitHub.
2. **Settings → Pages** → Source: rama `main`, carpeta `/` (raíz).
3. Asegúrate de tener el archivo `.nojekyll` en la raíz del repo.
4. Abre `https://tu-usuario.github.io/tu-repo/`.
5. Vuelve a configurar **API** (URL + clave); la configuración se guarda en el navegador (`localStorage`), no en el servidor.

---

## Checklist rápido

- [ ] Hoja con 4 pestañas: Solicitudes, Inventario, Tarifas, Usuarios
- [ ] Fila 1 con encabezados correctos en cada pestaña
- [ ] Al menos un usuario admin con `activo` = `si` y `pin` definido
- [ ] Inventario y tarifas con datos de ejemplo
- [ ] `Code.gs` pegado y `ADMIN_KEY` personalizada
- [ ] Web App desplegada con acceso **Cualquiera**
- [ ] URL `/exec` probada en el navegador
- [ ] URL y clave guardadas en la app (botón API)
- [ ] Prueba de crear una solicitud y verla en la hoja

---

## Problemas frecuentes

| Problema | Qué revisar |
|----------|-------------|
| `Clave de administrador invalida` | Misma clave en `ADMIN_KEY` del script y en el modal API de la app |
| `PIN incorrecto` | Columna `pin` en Usuarios, `activo` = `si`, sin espacios extra |
| No carga datos / CORS | Web App con acceso **Cualquiera**; URL termina en `/exec` |
| Cambios en script no se ven | Nueva versión en **Administrar implementaciones** |
| Página en blanco en GitHub Pages | Servir por HTTPS; archivo `.nojekyll` presente |
| La app sigue en modo prueba | Borra URL en API y vuelve a guardar; o vacía `localStorage` y reconfigura |
| Columnas desordenadas | Los nombres de la fila 1 deben coincidir exactamente con la tabla de esta guía |
| API devuelve datos pero Órdenes vacío | El filtro **Fecha** muestra solo el día actual: cambia la fecha o **Limpiar fecha**. Recarga la app (Ctrl+Shift+R) tras actualizar el código |
| `hora_entrega` rara (1899-12-30) | En Sheets usa formato **Hora** en esa columna; redespliega `Code.gs` con nueva versión |

---

## Archivos de referencia en el proyecto

| Archivo | Uso |
|---------|-----|
| `google-apps-script/Code.gs` | Código del API a pegar en Apps Script |
| `js/api.js` | Cliente que llama al Web App desde la app |
| `README.md` | Documentación general de la aplicación |
