# Estado actual del prototipo — auditoría por rol y flujo

**Fecha del relevamiento:** 2026-08-18
**Alcance:** los ~50 archivos HTML de `frontend/` (donante, hospital, admin/super admin, profesional, público) contrastados contra la capa de lógica compartida (`frontend/js/db.js`, `sesion.js`, `data.js`, `ui.js`) y contra los 20 JSON de `frontend/db/`.

Este documento es el mapa de "dónde estamos parados" del prototipo. Se actualiza a medida que se cierren gaps — cuando un flujo pase de 🔴/🟡 a 🟢, actualizá su fila acá mismo.

**Actualización 2026-08-19:** se cerró el primer bloque del camino feliz (registro de donante → reserva de turno → confirmación por el hospital → visualización del turno confirmado). Ese recorrido específico pasó de 🔴/🟡 a 🟢 y ahora tiene un test automatizado que lo revalida en un navegador real — ver [`/tests`](../tests). Las tablas de abajo quedan como estaban al momento de la auditoría original; para saber exactamente qué se conectó, ver el historial de commits.

---

## Cómo leer este documento

Cada flujo se clasifica en uno de tres estados:

| Estado | Significado |
|---|---|
| 🟢 **Funciona hoy** | La pantalla está conectada a datos reales (lee y/o escribe contra `frontend/db/*.json` vía la capa JS) y el resultado se ve reflejado en la UI. |
| 🟡 **Diseñado, no conectado** | La UI existe y es funcional visualmente, pero no hay datos reales detrás — o el binding de lectura está hecho pero no llega a pantalla (ver "patrón silencioso" abajo). |
| 🔴 **Roto / inexistente** | El botón/formulario no ejecuta ninguna lógica real: no tiene `onclick`, o el handler que tiene no persiste nada, o literalmente hace lo mismo que "Cancelar". |

## El hallazgo estructural (antes de entrar flujo por flujo)

Verificado directamente en el código, no es un problema puntual de una pantalla:

- **`frontend/js/db.js`** solo tiene funciones de **lectura**: `init()`, `find()`, `where()`, `all()`. No existe `create`, `update` ni `delete` en ningún archivo del proyecto.
- **`frontend/js/sesion.js`**: el login está **hardcodeado** a 4 pares email/password fijos — no lee `usuarios.json` para autenticar. No existe ninguna función de registro.
- **`frontend/js/data.js`**: solo agrega funciones de lectura para armar dashboards (5 de las ~9 posibles: `cargarDashboardDonante`, `cargarMisTurnos`, `cargarMisDocumentos`, `cargarDashboardHospital`, `cargarTurnosHoy`, `cargarTurnosProfesional`, `cargarDashboardAdmin`). Cero funciones de escritura.
- **Cero usos de `localStorage` en todo `frontend/`** (verificado). No hay ningún mecanismo para que una acción del usuario sobreviva a un cambio de página o un refresh.

Sobre esto se apilan **tres patrones repetidos** en decenas de pantallas:

1. **Botón sin handler.** El elemento no tiene `onclick` ni listener — clickear no hace absolutamente nada (ej: "Crear cuenta" en registro de donante, "Marcar todas como leídas" en notificaciones, "Guardar" en varios perfiles).
2. **"Guardar" = "Cancelar".** El botón de acción primaria de un modal llama literalmente a la misma función que el botón "Cancelar" — el modal se cierra sin persistir nada (ej: Registrar donación, Cargar resultado, Emitir certificado, Emitir factura).
3. **Lectura conectada pero silenciosa.** La función de `data.js` corre de verdad, trae datos reales del JSON, pero el HTML no tiene los `id` que esa función busca para inyectar el resultado — no hay error visible, el dato simplemente se pierde. Pasa en **3 de los 4 dashboards principales**: `hospital/dashboard.html`, `admin/dashboard.html`, `profesional/dashboard.html` (el único que sí funciona parcialmente es el flujo de login/sesión).

### Capa de escritura propuesta (transversal a todo el proyecto)

Como no hay backend, la solución consistente para *todos* los gaps de escritura de este documento es la misma: extender `db.js` con dos funciones genéricas y persistencia en `localStorage`:

```js
// en frontend/js/db.js
function crear(tabla, objeto) {
  const id = Math.max(0, ...data[tabla].map(r => r.id)) + 1;
  const nuevo = { id, ...objeto };
  data[tabla].push(nuevo);
  _persistir();
  return nuevo;
}

function actualizar(tabla, id, cambios) {
  const row = find(tabla, id);
  if (row) Object.assign(row, cambios);
  _persistir();
  return row;
}

function _persistir() {
  localStorage.setItem('hemored_overrides', JSON.stringify(data));
}

// en init(), antes o después del fetch: mergear localStorage.getItem('hemored_overrides') si existe
```

Cada gap "🔴 Roto" de las tablas siguientes se resuelve construyendo una función específica de negocio (ej. `reservarTurno`, `crearCampana`, `aprobarHospital`) que valide reglas propias y llame a `crear`/`actualizar` por debajo. Por eso no repetimos el boilerplate de `localStorage` en cada fila — solo la función de negocio puntual.

---

## Público / Onboarding

| Flujo | Vistas | Estado | Qué hace hoy | Qué falta |
|---|---|---|---|---|
| Landing pública | `index.html` | 🟢 | Navegación pura a login/registro con contexto de rol por querystring (`?rol=donante\|hospital`). Funciona. | — |
| Login | `publico/login.html` | 🟢 | Valida contra 4 usuarios hardcodeados en `sesion.js`, guarda sesión en `sessionStorage`, redirige por rol. | Para que sea "real": autenticar contra `usuarios.json` en vez del objeto fijo; falta el caso "hospital pendiente → redirigir a cuenta_pendiente" que la propia doc interna (`admin/documentacion.html`) da por hecho pero no está implementado. |
| **Registro de donante** | `publico/registro.html` (`#step-donante`) | 🔴 | El botón "Crear cuenta" **no tiene `onclick`** — clickear no hace nada. Hay una función `crearCuenta()` en el script pero no está conectada a ningún elemento (código muerto). | `registrarDonante({nombre, email, password, ...})` en `sesion.js`: valida email no duplicado (`db.where('usuarios','email',...)`), crea el usuario (`db.crear('usuarios', {...rol:'donante'})`), auto-loguea y redirige. |
| Registro de hospital | `publico/registro.html` (`#step-hospital`) → `publico/pago.html` | 🔴 | El botón navega directo a pago sin leer ni guardar ningún campo del formulario (CUIT, dirección, doc de habilitación, plan). | Guardar los datos del form en `sessionStorage` para pasarlos a `pago.html`; `crearHospitalPendiente(datos)` que cree el hospital con `estado:'pendiente'` (el esquema ya soporta este estado — hay un registro semilla así en `hospitales.json`). |
| Pago de plan hospital | `publico/pago.html` | 🔴 | `procesarPago()` solo cambia de vista visual. No crea factura, no crea el hospital, y **redirige directo a `hospital/dashboard.html` sin pasar por aprobación** — contradice el propio texto de la pantalla anterior ("tu cuenta quedará pendiente"). | Llamar a `crearHospitalPendiente()` al confirmar, y cambiar el redirect final a `cuenta_pendiente.html` (no al dashboard). |
| Cuenta pendiente de aprobación | `publico/cuenta_pendiente.html` | 🟡 | Pantalla con datos 100% hardcodeados. **Ningún flujo del código navega hacia acá hoy** — vista huérfana. | Conectar el redirect de `pago.html` (arriba) + leer datos reales del hospital recién creado. |
| Recuperar contraseña | `publico/recuperar.html` | 🔴 | 4 pasos que solo alternan clases CSS. No valida el email, no genera ni compara ningún código, no cambia ningún password. No incluye siquiera `db.js`/`sesion.js`. | `solicitarResetPassword`, `verificarCodigoReset`, `actualizarPassword` (usa `actualizar()`) en `sesion.js`. |
| Contacto / lead institucional | `publico/contacto.html` | 🔴 | El formulario extenso no se lee ni se guarda; solo muestra un mensaje de éxito visual. | `crear('mensajes', {...})` con los campos del form. (Tampoco existe hoy ninguna vista de admin que liste estos mensajes — habría que crearla también). |
| Nosotros / Términos / Privacidad | `publico/nosotros.html`, `terminos.html`, `privacidad.html` | 🟢 | Contenido estático, no requieren lógica de negocio. | — |

**Hallazgo clave de este grupo:** la propia documentación interna del proyecto (`admin/documentacion.html`) ya describe el flujo correcto (registro → pago → pendiente de aprobación) — el gap no es de diseño, es puramente de que nadie conectó el código a esa spec. Es el ejemplo más claro de "cableado faltante" de todo el prototipo.

---

## Donante

| Flujo | Vistas | Estado | Qué hace hoy | Qué falta |
|---|---|---|---|---|
| Explorar campañas | `donante/dashboard.html` | 🟢 | `renderCampanas()` pinta las tarjetas reales desde `campanas.json`/`hospitales.json`, stats y "próximo turno" con datos reales. | — |
| Reservar turno | `donante/campana_detalle.html` | 🟢 | `crearTurno()` valida turno duplicado, horario ocupado y regla de 90 días, y crea el turno real (`estado: pendiente`). Wizard con fechas/horarios generados dinámicamente. | — |
| Completar formularios pre-donación (F1/F2) | `donante/formularios_predonacion.html` | 🔴 | La firma digital (canvas) sí funciona y gatea el botón. Pero "Confirmar y enviar" no llama a `db.js` — nada se guarda en `formulario_consentimiento`. | `guardarFormularioConsentimiento(turno_id, {firma_donante_url, respuestas, ...})`, usando el dataURL de la firma ya capturada. |
| Mis turnos — ver (próximos/historial/cancelados) | `donante/mis_turnos.html` | 🟢 | `cargarMisTurnos()` cableado, las 3 pestañas y el banner de próximo turno muestran datos reales. | — |
| Mis turnos — cancelar / reprogramar | `donante/mis_turnos.html` (modal) | 🟢 | `actualizarTurno()` (ventana 24hs) y `cancelarTurno()` (ventana 2hs) reales, con fechas/horarios generados dinámicamente igual que en `campana_detalle.html`. Aplica la misma ventana sin diferenciar `pendiente`/`confirmado` (ver nota en docs/03). Si la ventana venció, el mensaje de error incluye el contacto del hospital. | — |
| Mis documentos | `donante/mis_documentos.html` | 🔴 | `cargarMisDocumentos()` **ya existe y funciona**, pero nunca se invoca acá — las 4 pestañas son datos fijos. "Enviar observación" no tiene `onclick`. | Cablear la función existente + joins con `resultado_analisis`/`certificado_donacion`/`formulario_consentimiento`. `solicitarCertificado()`, agregar el `onclick` faltante. |
| Mis donaciones | `donante/mis_donaciones.html` | 🔴 | 100% estático, no existe ninguna función de lectura para esta vista todavía. | `cargarMisDonaciones()` nueva en `data.js` (solo lectura, no requiere escritura). |
| Formulario post-donación anónimo (F4) | `donante/postdonacion_anonimo.html` | 🔴 | Lee el `token` de la URL pero **nunca lo valida** contra `formulario_postdonacion.json` (ni expiración ni uso previo). "Enviar" no persiste la respuesta. | `validarTokenPostdonacion(token)` + `guardarRespuestaPostdonacion()`. Única función de escritura del rol que debe funcionar **sin sesión** (por diseño de anonimato). |
| Notificaciones | `donante/notificaciones.html` | 🔴 | Sin ninguna llamada a `db.js`. "Marcar todas como leídas" no tiene `onclick`. Además: el esquema de `mensajes.json` no contempla notificaciones de donante (solo hospital↔admin) — falta modelo de datos, no solo cableado. | Extender esquema (tabla o campos nuevos) + `cargarNotificacionesDonante()` / `marcarNotificacionLeida()`. |
| Editar perfil | `donante/perfil.html` | 🟢 | `actualizarPerfilDonante()`, `actualizarPreferenciasNotificacion()`, `agregarEmpleador()`/`editarEmpleador()`/`eliminarEmpleador()` cableados sobre datos reales de `usuarios.json`. Editar un empleador reutiliza el mismo item de la lista (icono lápiz) con un mini-form inline; valida nombre vacío y nombre duplicado (contra el resto de la lista) antes de guardar, y si falla deja el form abierto con lo ya escrito en vez de cerrarlo. Se agregaron 8 campos nuevos (`experiencia_donante`, `ultima_donacion_fecha`, `ultima_donacion_fecha_aproximada`, `ultima_donacion_lugar`, `condiciones_medicas`, `notif_recordatorio_turno`, `notif_resultado_analisis`, `notif_campanas_urgentes`, ver `docs/01`) y se conectaron Datos personales, Datos médicos, Preferencias de notificaciones y Empleadores. En Datos médicos, si "¿Donaste antes?" es `habitual`/`ocasional` se despliega un bloque para cargar fecha (o fecha aproximada, si no la recuerda) y lugar de esa última donación. Estos campos son del perfil, no confundir con los homónimos del formulario de pre-donación (F2), que se preguntan de nuevo en cada turno. **"¿Donaste antes?" y `tipo_sangre` son de escritura única:** una vez guardados, el perfil bloquea permanentemente el select/grilla correspondiente (con un hint explicando por qué) — mismo tratamiento que el email, porque son datos históricos o pendientes de verificación médica real, no preferencias editables. El nombre/iniciales del sidebar se sincronizan al instante si se edita el nombre (`HemoRed.sesion.actualizarNombreSesion()`), sin necesidad de relogin. Test: `tests/perfil.spec.js`. | Queda afuera de esta vuelta la sección Seguridad (cambiar contraseña/email, eliminar cuenta — acciones más delicadas, requieren su propio diseño de flujo, no solo conexión a datos) y los indicadores "Completo/Pendiente/Opcional" de cada acordeón, que siguen hardcodeados y no reflejan el estado real de cada sección. |

**Estado 2026-08-19:** el camino núcleo del rol donante (buscar campaña → reservar turno → ver el turno en "Mis turnos") ya funciona de punta a punta y tiene test automatizado (ver [`/tests`](../tests)).

**Estado 2026-09-01:** se cerró también "Mis turnos — cancelar/reprogramar" (`actualizarTurno()`, `cancelarTurno()`), con su propio test (`tests/modificar-cancelar-turno.spec.js`). Se resolvió la pregunta abierta que había quedado pendiente: la ventana de 24h/2h aplica igual sobre un turno `pendiente` que sobre uno `confirmado` (mismo motivo de negocio en ambos casos — ver nota en "Mis turnos" de `docs/03`).

**Estado 2026-09-01 (2):** se cerró también "Editar perfil" (`actualizarPerfilDonante()`, `actualizarPreferenciasNotificacion()`, `agregarEmpleador()`/`eliminarEmpleador()`), con su propio test (`tests/perfil.spec.js`). Se resolvió el modelo de datos para "¿donaste antes?": el perfil (`usuarios`) tiene su propia foto general — `experiencia_donante` más, si contestó que sí donó antes, `ultima_donacion_fecha`/`ultima_donacion_fecha_aproximada`/`ultima_donacion_lugar` — editable en cualquier momento y sin relación con los campos homónimos del formulario de pre-donación, que se vuelven a preguntar en cada proceso de donación puntual y todavía no están implementados. Ver el detalle completo y el porqué de mantenerlos separados en `docs/01`.

### Próximos pasos — Donante (orden sugerido)

Quedan 5 flujos del rol donante sin conectar. Este es el orden sugerido para retomar, y por qué:

1. **Completar formularios pre-donación (F1/F2)** (`guardarFormularioConsentimiento()`). Es la continuación natural del turno que ya se reserva hoy — la firma digital (canvas) ya funciona, solo falta persistirla. Ahora también incluye los 3 campos nuevos de "última donación" (`ultima_donacion_fecha`, `ultima_donacion_fecha_aproximada`, `ultima_donacion_lugar`, ver `docs/01`).
2. **Mis donaciones** (`cargarMisDonaciones()`). Solo lectura, sin escritura — el de menor riesgo de los que quedan.
3. **Mis documentos** (cablear `cargarMisDocumentos()` que ya existe y funciona + `solicitarCertificado()`).
4. **Formulario post-donación anónimo F4** (`validarTokenPostdonacion()`, `guardarRespuestaPostdonacion()`). Particular: tiene que funcionar sin sesión, por el anonimato.
5. **Notificaciones**. El más grande: `mensajes.json` no contempla notificaciones de donante hoy (solo hospital↔admin), hay que decidir el modelo de datos antes de codear.

Después de Donante, los otros roles con flujos sin conectar son Hospital, Super Admin y Profesional de salud (v2) — ver sus tablas más abajo en este mismo documento.

---

## Hospital

### Campañas, turnos y documentación

| Flujo | Vistas | Estado | Qué hace hoy | Qué falta |
|---|---|---|---|---|
| Ver dashboard | `hospital/dashboard.html` | 🟡 | Mismo patrón "lectura silenciosa": `cargarDashboardHospital()` trae datos reales, el HTML no tiene los `id` para mostrarlos. | Agregar los `id` (`hospital-nombre`, `campanas-activas`, `turnos-hoy`) + render dinámico de las filas de campañas/turnos recientes. |
| Crear campaña — paso 1 | `hospital/nueva_campana.html` | 🔴 | El botón "Siguiente" hace `alert('Paso 2...')` — **ni siquiera navega**. Es el único caso del proyecto donde el flujo no avanza en absoluto. | Corregir la navegación real a paso 2 + `guardarBorradorCampana()` que arme el objeto y lo pase vía `sessionStorage`. |
| Crear campaña — paso 2 | `hospital/nueva_campana_paso2.html` | 🔴 | El "resumen" de la derecha es fijo, no refleja nada del paso 1 (no hay ningún mecanismo de traspaso entre pasos — cero `sessionStorage`/query params en todo el wizard). Sí navega de verdad al paso 3. | `guardarPaso2Campana()` que lea/complete el objeto de `sessionStorage` con días/horarios/duración de turno. |
| Crear campaña — paso 3 (publicar) | `hospital/nueva_campana_paso3.html` | 🔴 | "Publicar campaña" solo muestra una pantalla de éxito con un ID de campaña hardcodeado. **No crea ningún registro** — si el usuario va a `campanas.html` después, la campaña "publicada" no existe en ningún lado. | `publicarCampana(datosWizard)`: arma el registro completo desde lo acumulado en `sessionStorage` y lo persiste con `crear('campanas', {...})`. |
| Ver/gestionar campañas | `hospital/campanas.html` | 🔴 | Las 8 filas son fijas (la BD real tiene 4). El archivo nunca llama a ninguna función de datos. Botones Pausar/Reactivar/Editar/Eliminar sin `onclick`. | `cargarCampanasHospital()` (lectura) + `pausarCampana()`/`reactivarCampana()`/`cerrarCampana()` (escritura vía `actualizar()`). |
| Ver detalle de campaña | `hospital/campana_detalle.html` | 🔴 | 100% estático, no lee `id` de la URL. Botones de acción (Confirmar/Rechazar turno, Editar, Pausar, Cerrar) sin `onclick`. | `cargarDetalleCampana(id)` + `confirmarTurno()`/`rechazarTurno()`. |
| Gestionar turnos del día | `hospital/turnos.html` | 🔴 | `cargarTurnosHoy()` **ya existe y funciona**, pero esta página no la invoca — filas fijas. Botones Confirmar/Rechazar/"Confirmar todos" sin `onclick`. | Cablear la función existente al render + `confirmarTurno()`/`rechazarTurno()`/`confirmarTodosPendientes()`. |
| Modal "Registrar donación" | `hospital/turnos.html` (modal) | 🔴 | El botón "Confirmar donación" llama a la **misma función que "Cancelar"** — el modal se cierra sin leer ni un campo. | `registrarDonacion({...})`: crea el registro en `donaciones` + actualiza el turno a `completado`. |
| Cargar resultado de análisis | `hospital/documentacion.html` (modal) | 🔴 | Mismo patrón: "Cargar resultado" = "Cancelar". Lista de pendientes/cargados es fija. | `cargarResultadoAnalisis({...})`: crea en `resultado_analisis` **y además** en `documentos` (si no, el donante nunca lo ve en "Mis documentos"). **Pendiente de diseño (2026-09-01):** cuando se implemente esto, decidir si acá también se confirma/corrige `usuarios.tipo_sangre` (autoreportado y bloqueado desde el perfil del donante, ver `docs/01`) contra el resultado real del análisis. |
| Emitir certificado de donación | `hospital/documentacion.html` (modal) | 🔴 | Mismo patrón: "Emitir certificado" = "Cancelar". | `emitirCertificado({...})`: crea en `certificado_donacion` + `documentos` (mismo motivo dual que arriba). |

### Pacientes, profesionales, facturación y métricas

| Flujo | Vistas | Estado | Qué hace hoy | Qué falta |
|---|---|---|---|---|
| Registrar/listar pacientes | `hospital/pacientes.html` | 🔴 | Lista fija, no coincide con `pacientes.json`. "Guardar paciente" sin `onclick`. | `crearPaciente()`: crea en `pacientes` + vínculo en `paciente_hospital`. |
| Ver/editar detalle de paciente | `hospital/paciente_detalle.html` | 🔴 | No lee `id` de URL, siempre muestra el mismo paciente de ejemplo. "Guardar cambios" y "Registrar alta médica" sin efecto real. | Leer `?paciente_id=`, `actualizar()` sobre `pacientes`/`paciente_hospital`. |
| Registrar/gestionar profesionales | `hospital/profesionales.html` | 🔴 | Tarjetas fijas (4 vs. 2 reales en `profesionales.json`). "Guardar profesional" sin `onclick`. **No muestra el estado de firma digital**, pese a ser un requisito de negocio explícito (gate antes de asignar turnos). | `crearProfesional()` + agregar indicador visual de firma digital pendiente/registrada. |
| Ver detalle / desvincular profesional | `hospital/profesional_detalle.html` | 🔴 | Hardcodeado a un profesional fijo. **"Dar de baja" no tiene `onclick`** — no hay ni simulación. | Leer `?id=`, `desvincularProfesional()` (marca `profesional_hospital.activo:false`, conserva historial). |
| Consultar métricas del hospital | `hospital/metricas.html` | 🟡 | Los 3 gráficos y KPIs son arrays fijos en el script. El selector de período es un stub vacío. | `calcularMetricasHospital(periodo)`: agregación real sobre `turnos`/`donaciones`/`campanas` (solo lectura, no requiere escritura). |
| Ver/pagar facturas | `hospital/facturacion.html` | 🔴 | Filas fijas no coinciden con `facturas.json`. "Pagar ahora" sin `onclick`. | `registrarPagoFactura()`: `actualizar('facturas', id, {estado:'pagada', ...})`. |
| Solicitar cambio de plan | `hospital/perfil.html` | 🔴 | El botón solo navega a `pago.html`, no valida ni cambia nada. | `solicitarCambioPlan()`: valida downgrade contra campañas activas (regla ya documentada) + `crear` en `hospital_plan_historial`. |
| Ver/enviar mensajes con HemoRed | — | 🔴 | **No existe la pantalla.** `notificaciones.html` es un flujo distinto (alertas operativas, no mensajería). `mensajes.json` tiene hilos reales para el hospital semilla que nadie muestra. | Crear la vista + `enviarMensaje()`/`marcarMensajesLeidos()`. |
| Editar perfil del hospital | `hospital/perfil.html` | 🔴 | Todo hardcodeado. Ningún botón "Guardar" tiene `onclick`. Subir habilitación sanitaria solo muestra el nombre del archivo, no persiste. | `actualizarPerfilHospital()` + `subirHabilitacionSanitaria()` (crea entrada en `documentos`). |

---

## Super Admin

| Flujo | Vistas | Estado | Qué hace hoy | Qué falta |
|---|---|---|---|---|
| Dashboard global | `admin/dashboard.html` | 🟡 | Mismo patrón "lectura silenciosa": `cargarDashboardAdmin()` trae datos reales, el HTML no tiene los `id`. Charts con arrays fijos. | Agregar los `id` + render dinámico de tabla y gráficos. |
| Aprobar / rechazar hospital | `admin/hospitales.html`, `hospital_detalle.html` | 🔴 | "Aprobar" en las filas solo hace `stopPropagation()`. En el detalle, "Aprobar" es un `alert()` que no cambia nada; "Rechazar" no tiene `onclick`. El hospital semilla en estado `pendiente` no tiene forma de pasar a `activo`. | `actualizarEstadoHospital(id, estado, motivo)`. Requiere además pasar `id` real en la navegación (hoy `hospital_detalle.html` está hardcodeado a un solo hospital). |
| Listado y filtro de hospitales | `admin/hospitales.html` | 🟢 (parcial) | El filtro client-side funciona de verdad, pero sobre 7 filas fijas que no coinciden con los 5 hospitales reales de `hospitales.json`. | Reemplazar filas fijas por render desde `db.all('hospitales')`, conservando el filtro que ya funciona. |
| Detalle de hospital (facturación, mensajes, acciones) | `admin/hospital_detalle.html` | 🔴 | No lee `?id=`. "Marcar pagada", "Enviar mensaje", "Suspender cuenta" sin `onclick`. | `renderHospitalDetalle(id)` + `enviarMensajeHospital()`, `marcarFacturaPagada()`, `suspenderHospital()`. |
| Gestión de donantes | `admin/donantes.html`, `donante_detalle.html` | 🔴 | Filas fijas. "Suspender"/"Reactivar" en la lista sin `onclick`; en el detalle sí cambian una clase CSS visual pero se pierde al recargar (no toca `usuarios.json`). | `actualizarEstadoDonante()` + conectar detalle a `?id=` real. |
| Métricas globales | `admin/metricas.html` | 🔴 | Los ~12 gráficos son 100% mock, cero llamadas a `db.js`. "Aplicar filtros"/"Exportar" sin `onclick`. | `calcularMetricasGlobales(filtros)`: agregación real (solo lectura). |
| Gestión de planes | `admin/planes.html` | 🔴 | UI de alta/edición completa con preview en vivo, pero "Guardar plan" no lee los inputs — solo vuelve a la lista. "Suspender" sin `onclick`. | `crearPlan()`/`actualizarPlan()` + registrar cambios en `hospital_plan_historial`. |
| Facturación global | `admin/facturacion.html` | 🔴 | Filas fijas (6, no coinciden con `facturas.json`). "Notificar"/"Marcar pagada" sin `onclick`. | `marcarFacturaPagada()`, `notificarHospitalFactura()` (crea entrada en `mensajes`). |
| Emitir nueva factura | `admin/nueva_factura.html` | 🔴 | El cálculo de IVA/total en vivo sí funciona. "Emitir y enviar" solo muestra pantalla de éxito con número de factura **hardcodeado** — no crea nada. | `crearFactura()`: genera número correlativo real y persiste. |
| Documentación del sistema | `admin/documentacion.html` | 🟢 | Visor de documentación técnica interno (navegación, diagramas Mermaid, buscador) — funciona bien para su propio propósito, no maneja datos de negocio. | — |

**Hallazgo clave de este grupo:** ninguna de las 8 pantallas operativas de super admin escribe una sola vez en ningún lado — es el rol con el gap de escritura más completo del prototipo, a pesar de tener la UI más pulida.

---

## Profesional de salud (módulo v2)

| Flujo | Vistas | Estado | Qué hace hoy | Qué falta |
|---|---|---|---|---|
| Turnos del día (dashboard) | `profesional/dashboard.html` | 🟡 | Mismo patrón "lectura silenciosa": `cargarTurnosProfesional()` resuelve la cadena completa `usuario→profesional→hospital→turnos` correctamente, pero el HTML no tiene los `id` para mostrarlo. | Agregar los `id` + render de las tarjetas de turno desde el array real. |
| **Atención clínica (F1→F4 + QR)** | `profesional/dashboard.html` (modal) | 🟡 | **Es la pantalla más desarrollada de todo el prototipo**, no un esqueleto: checklist de autoexclusión, cuestionario médico de 42 preguntas real, firma digital (canvas), signos vitales con rangos de referencia, decisión apto/no apto con firma obligatoria, registro de extracción y generación de QR con token. Pero al finalizar, **nada se persiste**: no crea `donaciones`, no actualiza `turnos.estado`, no crea `formulario_consentimiento` ni `formulario_postdonacion`. Cerrar el modal borra todo. Usa un objeto de donantes hardcodeado, no conectado a los turnos reales. | Es el gap más grande en volumen de trabajo: `registrarDonacion()`, `guardarFormularioConsentimiento()`, `actualizarEstadoTurno()`, `generarTokenPostDonacion()` — 4 tablas nuevas por cada atención. Además conectar el modal a los turnos reales de `cargarTurnosProfesional()` en vez del objeto fijo. **Pendiente de diseño (2026-09-01):** en la primera donación real de cada donante, este es el lugar natural para que el profesional verifique/corrija `usuarios.tipo_sangre` (autoreportado y bloqueado desde el perfil, ver `docs/01`) contra el análisis real — todavía no está definido cómo. |
| Perfil y firma digital | `profesional/perfil.html` | 🔴 | El flujo de captura de firma (canvas) funciona y valida que no esté vacía, pero el propio código tiene un comentario `// Aquí se enviaría sigPad.toDataURL() al servidor` — nunca se guarda. Recargar restaura la firma de ejemplo original. | `actualizarFirmaProfesional(id, dataUrl)`: persiste en `profesionales.firma_digital_url`, archiva la anterior para historial. |

**Hallazgo clave de este grupo:** contradice la expectativa de "rol v2 = esqueleto". La UI clínica está construida con mucho detalle (coincide con el diseño de 4 formularios de los docs), pero tiene cero persistencia — es la brecha entre diseño visual y funcionalidad real más grande de todo el proyecto, medida en esfuerzo de implementación pendiente.

---

## Hoja de ruta sugerida

No es la única forma de ordenar esto, pero así es como priorizaría dado lo relevado:

### Paso 0 — Infraestructura (desbloquea casi todo lo demás)
Implementar `crear()` / `actualizar()` + persistencia en `localStorage` en `db.js` (ver sección "Capa de escritura propuesta" arriba). Sin esto, ningún flujo de escritura de la lista puede cerrarse.

### Paso 1 — Quick wins (bajo esfuerzo, alto impacto visual)
Los 3 dashboards con "lectura silenciosa" (`hospital/dashboard.html`, `admin/dashboard.html`, `profesional/dashboard.html`) más `donante/mis_turnos.html` y `donante/mis_documentos.html`: la lógica de lectura **ya existe y funciona**, solo falta agregar los `id` al HTML y cablear el render. Ningún flujo de escritura involucrado.

### Paso 2 — Flujos Must Have del MoSCoW (núcleo del producto)
Según la priorización ya definida en `docs/01-relevamiento-requisitos.md`: registro de donante, reserva de turno, creación de campaña (los 3 pasos), gestión de turnos por el hospital (confirmar/rechazar). Sin esto, el "camino feliz" completo (donante se registra → busca campaña → reserva turno → hospital gestiona) no se puede demostrar de punta a punta.

### Paso 3 — Cierre del círculo institucional
Registro de hospital → pago → cuenta pendiente → aprobación por super admin. Hoy cada mitad de este flujo existe pero no se tocan entre sí.

### Paso 4 — Should Have
Historial de donaciones, documentación (resultados/certificados con el insert dual a `documentos`), facturación (ambos lados: hospital paga, admin emite/marca pagada), mensajería hospital↔HemoRed (falta hasta la vista).

### Paso 5 — Podría esperar
Métricas con agregación real (hoy son gráficos de relleno, visualmente ya "funcionan" para una demo), gestión de pacientes/profesionales del lado hospital.

### Paso 6 — v2
El módulo de atención clínica del profesional (F1-F4). Es grande pero autocontenido — se puede abordar como un bloque separado una vez que el resto del MVP esté cerrado, ya que la UI ya está prácticamente lista y "solo" falta la capa de persistencia.
