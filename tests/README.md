# Tests E2E de HemoRed (frontend)

Esta carpeta contiene un test automatizado que abre el prototipo en un navegador real (Chromium, sin ventana visible) y simula a una persona usándolo: registrarse, buscar una campaña, reservar un turno, y que el hospital lo confirme. Es la forma de comprobar que un flujo *realmente funciona*, no solo que el código "parece correcto" al leerlo.

Está pensado para que lo pueda correr cualquiera de las tres, sin depender de que yo (o quien lo haya escrito) esté presente para explicarlo.

> **Por qué esta carpeta vive en la raíz del repo y no adentro de `frontend/`:** el workflow de GitHub Pages (`.github/workflows/deploy-pages.yml`) publica *toda* la carpeta `frontend/` tal cual. Si `tests/` estuviera adentro, estos archivos (nada sensible, pero sí ruido innecesario) quedarían públicamente accesibles en el sitio desplegado. Viviendo al lado de `frontend/`, queda automáticamente afuera de lo que se publica.

## Qué es esto, en criollo

- **Playwright** es una librería que maneja un navegador por código: entra a una URL, escribe en inputs, hace click, y puede "preguntarle" al navegador qué texto o elemento hay en pantalla.
- Un **test E2E** ("end-to-end", de punta a punta) simula el camino completo que haría un usuario real, cruzando varias pantallas — a diferencia de un test unitario, que prueba una sola función aislada.
- Como este prototipo **no tiene backend**, "guardar algo" significa escribir en el `localStorage` del navegador (ver `frontend/js/db.js`). Eso solo se puede verificar corriendo la página de verdad — no alcanza con leer el código.

## Instalación (una sola vez)

Necesitás tener [Node.js](https://nodejs.org/) instalado (con eso alcanza, no hace falta nada más).

```bash
cd tests
npm install                  # instala Playwright
npm run install-browsers     # descarga Chromium (~300MB, tarda un rato la primera vez)
```

## Cómo correrlo

```bash
cd tests
npm test
```

Esto va a:
1. Levantar automáticamente un servidor local sirviendo `frontend/` (no hace falta que lo arranques vos a mano — si ya tenés uno corriendo en el puerto 8791, lo reusa).
2. Abrir Chromium sin ventana visible y correr todo el flujo.
3. Mostrarte en la terminal si cada paso pasó (✓) o falló (✗).

**Otras formas de correrlo, útiles mientras estás debuggeando:**

```bash
npm run test:headed   # corre lo mismo pero mostrando la ventana del navegador — se ve todo en vivo
npm run test:debug    # abre el inspector de Playwright, podés ir paso a paso
npm run report        # abre un reporte HTML navegable de la última corrida (con capturas si algo falló)
```

## Si un test falla

Playwright guarda automáticamente una captura de pantalla y un video del momento exacto en que falló (configurado en `playwright.config.js`). Corré `npm run report` después de una corrida fallida — vas a ver visualmente en qué pantalla se rompió, no solo un mensaje de error en texto.

## Qué cubre hoy

**`golden-path.spec.js`** — el "camino feliz" completo entre 3 roles:

1. Un donante nuevo se registra (`publico/registro.html`)
2. Ve campañas reales en su dashboard (`donante/dashboard.html`)
3. Reserva un turno (`donante/campana_detalle.html`)
4. El hospital ve el turno como "Pendiente" (`hospital/turnos.html`)
5. El hospital lo confirma
6. El donante, al volver a loguearse, ve el turno "Confirmado" (`donante/mis_turnos.html`)

**`modificar-cancelar-turno.spec.js`** — el segundo bloque de Donante, agregado 2026-09-01:

1. Un turno reservado con más de 24hs de anticipación se puede reprogramar (nueva fecha/horario) y después cancelar sin problema.
2. Un turno para el que ya venció la ventana de tiempo (2hs para cancelar, 24hs para reprogramar) se rechaza con el motivo de negocio explicado y el contacto del hospital — no con un error genérico.

## Qué NO cubre todavía

Estos tests prueban únicamente los caminos que ya conectamos. Para saber qué otros flujos del sistema están sin conectar (y por lo tanto no tiene sentido todavía escribirles un test, porque fallarían por diseño), mirá **`docs/04-estado-actual-prototipo.md`** — ahí está el detalle rol por rol de qué funciona y qué falta.

Flujos que sabemos que faltan probar (porque todavía no están conectados a datos reales, no porque nos olvidamos):
- Rechazo de turno por parte del hospital (el botón "Rechazar" existe pero no tiene test)
- Registro de hospital → pago → aprobación por super admin (todo ese circuito está roto hoy, ver docs/04)
- Cualquier flujo de Super Admin
- El módulo de Profesional de salud (previsto para v2)

## Cómo agregar un test nuevo

Cada `test.step(...)` dentro de `golden-path.spec.js` es un paso lógico del flujo. Para agregar un caso nuevo (por ejemplo, "el hospital rechaza un turno"), lo más simple es copiar el archivo como referencia y armar un `test()` nuevo:

```js
test('el hospital puede rechazar un turno pendiente', async ({ page }) => {
  await test.step('...', async () => {
    // repetí los pasos 1-4 de golden-path.spec.js hasta tener un turno pendiente
  });

  await test.step('el hospital rechaza el turno', async () => {
    await page.locator('.turno-row', { hasText: '...' })
      .locator('button:has-text("Rechazar")')
      .click();
    // ojo: rechazarTurno() dispara un prompt() del navegador (motivo del rechazo).
    // Playwright lo maneja escuchando el evento 'dialog':
    page.once('dialog', dialog => dialog.accept('Motivo de prueba'));
  });
});
```

Regla general: si el flujo que querés probar figura como 🔴 o 🟡 en `docs/04-estado-actual-prototipo.md`, no le escribas un test todavía — primero hay que conectarlo (ver ese documento para la función de JS que falta), si no el test va a fallar por una razón que ya conocemos de antemano.

## Roadmap: qué va a cambiar acá cuando exista el backend

Este test hoy asume un mundo sin backend: cada corrida arranca con una sesión de navegador limpia (sin `localStorage` previo), así que los datos que crea (un donante nuevo, un turno nuevo) no chocan entre corridas. Eso **deja de ser cierto** el día que haya una base de datos real compartida. Anotamos acá lo que hay que revisar en ese momento para que no se pierda el contexto:

- **Reseteo de datos entre corridas.** Con una BD real, correr este test muchas veces va a ir acumulando donantes y turnos de prueba. Hace falta un mecanismo de "reset" (fixture/seed de base de datos) antes de cada corrida — típicamente un endpoint de testing, un comando de Django management (`manage.py flush` + `loaddata`), o una base de datos de test separada que se recrea en cada corrida.
- **Actualizar `db.js` → `fetch`.** El día que el frontend deje de usar `HemoRed.db.crear()`/`localStorage` y pase a llamar a la API real, este test *no debería necesitar cambios* en los `page.click()`/`page.fill()` — solo en la infraestructura (puede que haga falta esperar un poco más por las respuestas de red, o interceptar requests para verificar el payload enviado).
- **Sumar tests de API, aparte de este.** Este archivo prueba la interfaz visual. Cuando exista `backend/` con Django, conviene un segundo nivel de tests que pegue directo contra la API REST, sin pasar por el navegador — mucho más rápido y más fácil de aislar cuando algo falla. Opciones:
  - Una **colección de Postman** versionada en `backend/` (o `docs/`) con un request por endpoint de los 53 documentados en `docs/01-relevamiento-requisitos.md`, para probeo manual rápido durante el desarrollo.
  - Tests automatizados de backend con `pytest` + `Django REST Framework`'s test client (el estándar en proyectos Django) — estos son responsabilidad del código en `backend/`, no de esta carpeta.
- **Autenticación real.** Hoy el login es contra 4 usuarios hardcodeados en `sesion.js`. Con JWT real, este test va a necesitar loguearse contra la API antes de cada corrida (probablemente vía un helper que haga el POST a `/api/auth/login` y guarde el token, en vez de completar el formulario HTML cada vez — más rápido para los tests que no están probando el login en sí).
- **Casos de error del lado del servidor.** Hoy los errores de validación (ej. "no podés donar, pasaron menos de 90 días") los tira el JavaScript del navegador. Con backend real, la MISMA validación tiene que existir del lado del servidor (ver la conversación sobre por qué la validación de cliente no alcanza) — vale la pena agregar un test que confirme que la API devuelve 409/400 en esos casos, no solo que la UI lo bloquea.

Si en algún momento se necesita cualquiera de estos puntos y no está resuelto, no hace falta rediseñar todo desde cero — esta sección ya deja anotado el "por dónde empezar".
