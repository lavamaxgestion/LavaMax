# LavaRent - Gestion de alquiler de lavadoras

Aplicacion web para gestionar solicitudes de alquiler de lavadoras, con despliegue en **GitHub Pages** y base de datos en **Google Sheets** (via Google Apps Script).

## Funcionalidades

- **Ordenes**: lista de solicitudes ordenadas por fecha/hora de entrega (la mas proxima primero)
- **Nueva solicitud**: formulario para registrar clientes y entregas
- **Administrador**:
  - Inventario de lavadoras
  - Tarifas
  - Usuarios
  - Reportes financieros por rango de fechas

## Arquitectura

```
GitHub Pages (HTML/JS)  -->  Google Apps Script Web App  -->  Google Sheets
```

## 1. Configurar Google Sheets

1. Crea una hoja de calculo nueva en Google Drive.
2. Crea estas pestanas (o dejalas crearse automaticamente al usar el script):
   - `Solicitudes`
   - `Inventario`
   - `Tarifas`
   - `Usuarios`
3. Ve a **Extensiones > Apps Script**.
4. Copia el contenido de `google-apps-script/Code.gs`.
5. Cambia `ADMIN_KEY` por una clave segura (la usaras en la app para modulo admin).
6. **Implementar > Nueva implementacion**:
   - Tipo: Aplicacion web
   - Ejecutar como: Yo
   - Quien tiene acceso: **Cualquiera**
7. Copia la URL que termina en `/exec`.

### Datos de ejemplo (Inventario)

| id | codigo | modelo | capacidad_kg | estado |
|----|--------|--------|--------------|--------|
| (auto) | LAV-01 | Samsung 18kg | 18 | disponible |

### Datos de ejemplo (Tarifas)

| id | nombre | precio_dia | descripcion |
|----|--------|------------|-------------|
| (auto) | Estandar | 25000 | Por dia |

## 2. Configurar la aplicacion web

1. Abre la app (local o en GitHub Pages).
2. Clic en **API** en el menu lateral.
3. Pega la URL del Web App y la clave admin.
4. Guardar.

## 3. Desplegar en GitHub Pages

### Opcion A: Carpeta `docs/`

1. Sube este proyecto a un repositorio de GitHub.
2. Renombra o copia el contenido de `gestion-lavadoras/` a la raiz del repo (o usa la carpeta como raiz del sitio).
3. En el repo: **Settings > Pages**:
   - Source: Deploy from a branch
   - Branch: `main` / carpeta `/` (o `/docs` si usas docs)

### Opcion B: Rama `gh-pages`

```bash
cd gestion-lavadoras
git init
git add .
git commit -m "App gestion lavadoras"
git branch -M main
git remote add origin TU_REPO_URL
git push -u origin main
```

Luego activa GitHub Pages desde la rama `main` y carpeta raiz.

### Probar en local

```bash
cd gestion-lavadoras
npx serve .
# o: python3 -m http.server 8080
```

Abre `http://localhost:8080` (los modulos ES requieren un servidor, no abras el HTML directamente con `file://`).

## Orden de las solicitudes

Las ordenes se ordenan por **fecha + hora de entrega** ascendente: la entrega mas cercana aparece primero. Las que vencen en menos de 24 horas se marcan como **Pronto**.

## Seguridad

- Las operaciones de administrador (usuarios, inventario, tarifas, reportes) requieren `adminKey`.
- Crear solicitudes es publico (para clientes desde tu sitio en Pages).
- Para mayor seguridad, puedes restringir la Web App y usar un proxy; para uso interno pequeno, la clave admin es suficiente.

## Estructura del proyecto

```
gestion-lavadoras/
  index.html
  css/styles.css
  js/
    app.js
    api.js
    views/
      ordenes.js
      nueva-solicitud.js
      admin.js
  google-apps-script/Code.gs
  .nojekyll
```

## Solucion de problemas

| Problema | Solucion |
|----------|----------|
| CORS / no carga datos | Verifica que la Web App este desplegada con acceso "Cualquiera" |
| Clave invalida en admin | Usa la misma `ADMIN_KEY` del script en la app |
| Pagina en blanco en Pages | Asegurate de tener `.nojekyll` y servir desde HTTPS |
| Modulos no cargan en local | Usa un servidor HTTP (`serve`, `python -m http.server`) |
