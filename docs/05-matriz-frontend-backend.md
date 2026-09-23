# Matriz: qué es frontend puro y qué va a consumir el backend

**Fecha:** 2026-09-23
**Por qué existe esto:** hoy `frontend/` es un prototipo 100% estático (HTML/CSS/JS vanilla, sin build) que **simula** tener un backend: `frontend/js/db.js` lee los 20 JSON de `frontend/db/` y, desde que se agregaron `crear()`/`actualizar()`, además simula escrituras guardándolas en `localStorage` (ver "Capa de escritura propuesta" en `docs/04`). Cuando exista el backend real (Django REST + PostgreSQL, ver `docs/03`, sección "Arquitectura"), **no todo el código de `frontend/js/data.js` se tira** — una parte se queda tal cual en el cliente (React, en la versión final) y otra parte se reemplaza por un `fetch`/llamada a la API. Esta matriz separa una cosa de la otra para no perder tiempo el día que se conecte el backend de verdad, ni asumir por error que algo "ya está resuelto" porque hoy funciona en el prototipo.

## Cómo leer esto

| Categoría | Significado |
|---|---|
| 🖥️ **Frontend puro** | Vive en el cliente para siempre, con o sin backend. No depende de ningún dato del servidor más allá de lo que ya se cargó en pantalla. |
| 🔌 **Consume API** | Hoy está simulado con `db.js` (`find`/`where`/`all`/`crear`/`actualizar` sobre JSON + `localStorage`). El día de mañana, la MISMA función de negocio sigue existiendo (mismo nombre, mismo lugar en el flujo), pero por dentro hace un `fetch('/api/...')` en vez de tocar `localStorage`. La UI que la llama no debería necesitar cambios grandes. |
| 🆕 **Backend nuevo** | No existe ninguna simulación de esto en el prototipo hoy — es lógica que solo tiene sentido con un servidor real (contraseñas hasheadas, tokens JWT de verdad, envío de emails, cobro de tarjetas, jobs programados, storage de archivos). No hay "función existente" que adaptar, hay que escribirla de cero del lado del backend. |

---

## 1. Frontend puro (no cambia cuando llegue el backend)

| Funcionalidad | Dónde vive hoy | Nota |
|---|---|---|
| Renderizado de tarjetas/listas/tablas a partir de un array ya cargado | `donante.css`/`hospital.css`/etc. + los `.map(...).join('')` de cada `data.js` | El array puede venir de `db.js` (hoy) o de la respuesta de una API (mañana) — la función que arma el HTML a partir del array es la misma código. |
| Pestañas, acordeones, modales (abrir/cerrar) | `HemoRed.ui.abrirModal()`/`cerrarModal()`, `cambiarTab()`, `toggleSeccion()` en cada página | Estado 100% de UI, nunca toca datos del servidor. |
| Sidebar / menú mobile (hamburguesa, overlay, botón cerrar) | `HemoRed.ui` + CSS de cada rol | Igual que arriba. |
| Validación de formulario "en vivo" (contraseñas coinciden, campos vacíos, formato de email) | Cada `<script>` de página, antes de llamar a la función de negocio | Esta validación es una primera barrera de UX — el backend SIEMPRE tiene que validar lo mismo de nuevo del lado del servidor (nunca confiar solo en el cliente), pero la versión del cliente no desaparece: sigue dando feedback inmediato sin esperar una respuesta de red. |
| Selector de fecha/hora del wizard de turnos (`.fecha-tab`, `.turno-opt`) | `campana_detalle.html`/`mis_turnos.html` | Hoy genera las fechas dinámicamente en JS a partir de "hoy" (`HemoRed.data.ahora()`) — con backend, la disponibilidad real (qué horarios ya están ocupados) sí va a venir de la API, pero el componente visual del calendario en sí sigue siendo frontend. |
| Firma digital (canvas, SignaturePad) | `initPad()`/`clearSig()` en `formularios_predonacion.html` y `profesional/perfil.html` | El DIBUJO de la firma es 100% cliente. Lo que cambia es qué se hace con el resultado: hoy se guarda el `dataURL` (base64) directo en el JSON simulado; con backend, ese `dataURL` se sube a un storage de archivos (S3, según `docs/03`) y lo que se persiste en la base es la URL. |
| Generación del archivo `.ics` para "Agregar al calendario" | `agregarCalendario()`, `campana_detalle.html` | Se arma un archivo de texto plano en el navegador y se dispara la descarga — no necesita ida y vuelta al servidor. |
| Componente de select personalizado (reemplazo visual de `<select>`) | `HemoRed.ui.mejorarSelects()`, `global.css` | Puramente estético/interacción, no tiene ningún dato de negocio adentro. |
| Mostrar/ocultar contraseña en inputs | `HemoRed.ui.mejorarPasswords()` | Igual. |
| Tooltips (`data-tooltip`) | `global.css` | Igual. |
| Responsive (todo lo trabajado en esta sesión: `min-width:0`, colapso de sidebar, grillas a 1 columna en mobile, etc.) | Todos los `estilos/*.css` | El diseño responsive no tiene ninguna relación con de dónde vienen los datos. |
| Cálculo de "elegibilidad para donar" mostrado ANTES de reservar (edad, peso, 90 días) | `verificarElegibilidadReserva()`, `campana_detalle.html`/`dashboard.html` | Esto es un caso mixto real: hoy la regla de negocio está calculada en el cliente porque no hay otro lugar donde calcularla. Con backend, **la validación que manda es la del servidor** (ver fila correspondiente en la sección 2) — pero tiene sentido dejar una copia liviana de la misma regla en el cliente para avisar al donante de entrada, sin que tenga que llenar todo el formulario y recién ahí enterarse. Por eso queda en las dos listas: la versión "seria" es 🔌, esta es la versión de UX inmediata. |

---

## 2. Consume API (hoy simulado con `db.js` + `localStorage`, mañana `fetch` real)

Agrupado por rol, mismo criterio de filas que `docs/04` para que sea fácil cruzar una tabla con la otra.

### Transversal (todos los roles)

| Funcionalidad | Función hoy (`frontend/js/`) | Qué cambia con backend |
|---|---|---|
| Login | `sesion.js` — hoy hardcodeado a 4 pares fijos, ni siquiera lee `usuarios.json` | Se vuelve `POST /api/auth/login` con JWT real (hoy no hay ningún token, la sesión es solo un objeto en `sessionStorage`). Es el gap más grande de este grupo: hoy literalmente no hay autenticación real que reemplazar, hay que construirla. |
| Registro (cualquier rol) | No implementado (🔴 en las 4 tablas de `docs/04`) | `POST /api/auth/registro/{rol}` — valida email no duplicado, hashea contraseña. |
| Toda lectura de listados/dashboards | `db.js`: `find()`/`where()`/`all()` sobre JSON estático | `GET /api/{recurso}` — mismo shape de datos esperado, cambia el origen. |
| Toda escritura (crear/actualizar un registro) | `db.js`: `crear()`/`actualizar()` sobre `localStorage` | `POST`/`PATCH /api/{recurso}` — la función de negocio (`crearTurno()`, `confirmarTurno()`, etc.) se queda, cambia lo que hay dentro suyo. |

### Donante

| Funcionalidad | Función hoy | Nota |
|---|---|---|
| Reservar/modificar/cancelar turno | `crearTurno()`/`actualizarTurno()`/`cancelarTurno()` (`data.js`) | Incluye la validación "seria" de elegibilidad (edad/peso/90 días/turno activo) — hoy corre en el cliente contra los JSON cargados, mañana la valida el servidor contra la base real (más difícil de eludir, y necesario si en algún momento hay más de un cliente, ej. la app mobile). |
| Completar F1/F2 | `guardarFormularioConsentimiento()` | Incluye subir las 2 firmas (ver "Firma digital" en la sección 1 — el dibujo es frontend, el archivo resultante va al backend). |
| Ver mis turnos/documentos/donaciones | `cargarMisTurnos()`/`cargarMisDocumentos()`/`cargarMisDonaciones()` | — |
| Editar perfil, cambiar contraseña/email, eliminar cuenta | `actualizarPerfilDonante()`, `cambiarPasswordDonante()`, etc. | Cambiar contraseña real requiere backend sí o sí (hoy no hay contraseña real que cambiar para las 4 cuentas demo). |
| Notificaciones (leer, marcar leídas) | `cargarNotificacionesDonante()`, `marcarNotificacionLeida()` | — |
| Solicitudes de corrección sobre certificados | `crearSolicitudCorreccion()` | — |
| Formulario post-donación anónimo (F4) | `validarTokenPostdonacion()`, `guardarRespuestaPostdonacion()` | El anonimato (sin sesión) se mantiene igual del lado de la API — el token sigue sin llevar `usuario_id`. |

### Hospital

| Funcionalidad | Función hoy | Nota |
|---|---|---|
| Dashboard, gestión de turnos del día | `cargarDashboardHospital()`, `cargarTurnosHoy()`, `confirmarTurno()`/`rechazarTurno()` | — |
| Registrar donación | `registrarDonacion()` | Genera el token de F4 — con backend, ese token se manda también a un servicio real de generación de QR (hoy es una librería de JS en el cliente, que probablemente se mantenga igual en la sección 1, solo cambia el token que codifica). |
| Crear/gestionar campañas (los 3 pasos del wizard) | No implementado — sería `publicarCampana()` | Todo el wizard hoy no tiene ni `sessionStorage` entre pasos; con backend, probablemente se guarde un borrador real en el servidor entre paso y paso en vez de en el navegador. |
| Cargar resultado de análisis / emitir certificado | No implementado | — |
| Gestionar pacientes / profesionales | No implementado | — |
| Facturación / cambio de plan | No implementado | El pago en sí (MercadoPago, según `docs/03`) es 🆕 Backend nuevo — la INTEGRACIÓN con la pasarela no tiene ninguna simulación hoy. Consultar el estado de una factura ya emitida sí es 🔌. |
| Métricas del hospital | `calcularMetricasHospital()` (a implementar) | Hoy los 3 gráficos son arrays fijos — la agregación real (sumar/promediar sobre `turnos`/`donaciones`) puede hacerse en el cliente sobre datos ya traídos, PERO con volumen real de datos es mucho más eficiente que la agregación la haga el backend (`GET /api/hospital/metricas?periodo=...` ya devuelve los números calculados, no todos los turnos crudos). |

### Super Admin

| Funcionalidad | Función hoy | Nota |
|---|---|---|
| Aprobar/rechazar/suspender hospital | No implementado | Suspender dispara cascada (pausar campañas, cancelar turnos, notificar donantes) — con backend esto probablemente sea una transacción del servidor, no una serie de llamadas sueltas desde el cliente. |
| Gestión de donantes, planes, facturación global | No implementado | — |
| Métricas globales | No implementado | Mismo caso que métricas de hospital — agregación mejor del lado del servidor. |

### Profesional de salud (v2)

| Funcionalidad | Función hoy | Nota |
|---|---|---|
| Atención clínica completa (F1→F4, evaluación, extracción) | UI construida, cero persistencia (ver `docs/04`) | Es el módulo con más funciones nuevas a escribir de punta a punta — ninguna de las 4-5 funciones de negocio que necesita existe todavía, ni siquiera simulada. |
| Firma digital de perfil | UI funciona, comentario `// se enviaría al servidor` sin implementar | — |

---

## 3. Backend nuevo (no hay nada que adaptar — se escribe de cero, ver `docs/03`)

| Funcionalidad | Por qué no está simulada hoy |
|---|---|
| Autenticación JWT real (tokens, refresh, expiración) | El prototipo no tiene backend que emita tokens — la "sesión" hoy es un objeto plano en `sessionStorage`, no un token. |
| Hash de contraseñas (bcrypt) | Las 4 cuentas demo tienen la contraseña en texto plano en `sesion.js`. |
| Envío de emails (SendGrid) — bienvenida, notificación de aprobación, recuperación de contraseña | Ningún flujo de email está ni mockeado; donde correspondería (ej. aprobación de hospital), el prototipo simplemente no lo menciona. |
| Cobro de tarjeta (MercadoPago) | `pago.html` solo cambia de vista, no simula ninguna respuesta de pasarela. |
| Storage de archivos real (S3) — firmas, habilitación sanitaria en PDF, PDFs de certificados | Hoy las firmas se guardan como `dataURL` (base64) directo en el JSON/`localStorage`; los PDFs de certificado ni existen como archivo (son datos estructurados que se renderizan en pantalla, no un PDF real — ver "Descargar PDF" en `docs/04`, Mis documentos). |
| Job programado para marcar turnos `ausente` automáticamente | Está sugerido como mejora futura en `docs/03` ("Mis turnos") — hoy esa marca la hace un humano a mano, y ni siquiera esa parte manual está implementada. |
| Validación de reglas de negocio del lado del servidor (no confiar en el cliente) | Cada regla de negocio del prototipo (elegibilidad, ventanas de 24h/2h, downgrade de plan, etc.) hoy se valida SOLO en el cliente — con backend, la misma regla se tiene que reimplementar ahí (la del cliente no se saca, pero deja de ser la única línea de defensa). |
| Rate limiting, protección CSRF/XSS del lado del servidor, logs de auditoría reales | No aplica a un prototipo sin servidor. |

---

## Para tener en cuenta al planificar el trabajo de backend

La mayoría de las funciones de "Consume API" (sección 2) **ya tienen su contraparte de negocio escrita y probada en el frontend** (con tests de Playwright que ejercitan el comportamiento esperado) — el trabajo de backend en esos casos es más de "replicar la misma regla de negocio en Django" que de "diseñar la regla desde cero", porque ya se peleó con los casos borde acá (ver por ejemplo las ventanas de 24hs/2hs de turnos, la validación de elegibilidad de 90 días, o el bloqueo de F2 ante respuesta inhabilitante). Los tests E2E de `/tests` documentan el comportamiento esperado exacto — son una buena referencia de "qué tiene que seguir pasando" al mover cada función al backend real.
