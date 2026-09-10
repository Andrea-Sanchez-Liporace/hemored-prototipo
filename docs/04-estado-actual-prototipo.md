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
| Explorar campañas | `donante/dashboard.html` | 🟢 | `renderCampanas()` pinta las tarjetas reales desde `campanas.json`/`hospitales.json`, stats y "próximo turno" con datos reales. | **Dependencia cruzada:** las 4 campañas que se ven hoy son las 4 semilla — "Crear campaña" del Hospital (los 3 pasos del wizard) está sin conectar (🔴, ver sección Hospital), así que no va a aparecer ninguna campaña nueva hasta que ese flujo se cablee. No es un límite de esta pantalla. |
| Reservar turno | `donante/campana_detalle.html` | 🟢 | `crearTurno()` valida turno duplicado (misma campaña), horario ocupado y regla de 90 días desde la última donación, y crea el turno real (`estado: pendiente`). Wizard con fechas/horarios generados dinámicamente. La confirmación del lado del hospital (`hospital/turnos.html`) ya está conectada — ver esa fila más abajo, se había quedado mal marcada como pendiente. | Validación de elegibilidad incompleta — ver "Pendiente de diseño: restricciones de elegibilidad para reservar turno" más abajo (anotado 2026-09-01, no implementado todavía). **Dependencia cruzada:** la regla de 90 días compara contra `donaciones`, que hoy solo tiene los 2 registros semilla (mismo motivo que en la fila "Mis donaciones" — `registrarDonacion()` del Profesional todavía no está conectado). |
| Completar formularios pre-donación (F1/F2) | `donante/formularios_predonacion.html` | 🟢 | `guardarFormularioConsentimiento()` persiste ambas firmas (F1 autoexclusión + F2 cuestionario, dos firmas distintas), las 34 respuestas del cuestionario médico (con sus valores por default, no solo lo que el donante cambia) y las observaciones, ancladas a `turno_id` (`donacion_id` queda `null` hasta que el profesional registre la donación real). Actualiza `turnos.formulario_autoexclusion_completado`/`formulario_cuestionario_completado` para que los badges de "Mis turnos" reflejen el estado real. La página ahora lee `?turno_id=` de la URL y muestra los datos reales del turno en el banner — antes era 100% fijo. De paso se corrigió un bug de layout real (`body{display:flex}` de `donante.css`, pensado para el layout con sidebar de otras pantallas, rompía esta página en las 3 resoluciones porque no usa sidebar). Si el donante reentra a un turno ya completado, `cargarFormulario()` restaura todo: las 34 respuestas (incluidas las que quedaron en su default), observaciones, los 3 checks de F1 y ambas firmas — reconstruye cada `SignaturePad` con `fromDataURL()` (confirmado que `isEmpty()` refleja bien el estado restaurado, no es solo apariencia visual) y las clases `sel-si`/`sel-no` de cada pregunta. Re-enviar sin cambios actualiza el mismo registro (por `turno_id`), no crea uno duplicado. Test: `tests/formularios-predonacion.spec.js`. **F1/F2 es el formulario estándar de los hemocentros del país — no se le agregaron campos propios de HemoRed** (ver nota en `docs/01`). | El botón "Completar formularios" en `mis_turnos.html` no cambia a un estado distinto ("ya completado, ver resumen") cuando el turno ya está completo — lleva al mismo formulario editable (que ahora sí aparece prellenado). Convertirlo en una vista de solo lectura separada queda afuera de esta vuelta. |
| Mis turnos — ver (próximos/historial/cancelados) | `donante/mis_turnos.html` | 🟢 | `cargarMisTurnos()` cableado, las 3 pestañas y el banner de próximo turno muestran datos reales. | — |
| Mis turnos — cancelar / reprogramar | `donante/mis_turnos.html` (modal) | 🟢 | `actualizarTurno()` (ventana 24hs) y `cancelarTurno()` (ventana 2hs) reales, con fechas/horarios generados dinámicamente igual que en `campana_detalle.html`. Aplica la misma ventana sin diferenciar `pendiente`/`confirmado` (ver nota en docs/03). Si la ventana venció, el mensaje de error incluye el contacto del hospital. | — |
| Mis documentos | `donante/mis_documentos.html` | 🟢 | `cargarMisDocumentos()` ahora resuelve el join completo: `documentos` es solo un índice (`tipo` + `referencia_id`), se cruza contra `resultado_analisis`, `certificado_donacion`, `donaciones` (para evaluación clínica — los signos vitales viven ahí, no hay tabla propia) y `formulario_consentimiento` (que no pasa por `documentos`, se consulta directo por `usuario_id`). `solicitarCertificado(donacionId)` es escritura real: crea un `documentos` pendiente (sin `certificado_donacion` todavía) si la donación no tiene uno, y rechaza duplicados. **Bug real encontrado y corregido:** la pestaña "Evaluaciones clínicas" tiraba un error de JS al clickearla — el botón existía pero su contenido (`#tab-evaluaciones`) nunca se había creado; había además una vista de detalle (`view-evaluacion`) completamente huérfana, sin nada que la llamara. Ambas quedaron conectadas. También se corrigieron 2 bugs de CSS reales (mismo patrón de cascada que ya encontramos en `.quick-stats`): `.resultado-layout` y `.certificado-layout` no colapsaban a una columna en mobile. "Enviar observación" (texto libre, no persistía nada) fue reemplazado por el flujo completo de **solicitudes de corrección** — ver esa sección más abajo. Test: `tests/mis-documentos.spec.js`. | El campo "emitido para" del certificado sigue sin persistirse (no hay campo en `certificado_donacion` para eso, ver `docs/01`). |
| Mis donaciones | `donante/mis_donaciones.html` | 🟢 | `cargarMisDonaciones()` (solo lectura) trae las donaciones reales del donante con el hospital ya resuelto. Estadísticas (total, ml donados, última donación) y el banner de "próxima fecha habilitada" calculados de verdad — este último reutiliza la misma ventana de 90 días que ya usa `crearTurno()` (no es un número nuevo inventado para esta pantalla) y se oculta solo si ya se puede donar. Los filtros de año/resultado, que ya eran funcionales sobre contenido fijo, ahora filtran sobre datos reales. Test: `tests/mis-donaciones.spec.js`. De paso se corrigieron 2 bugs de CSS reales en `donante.css` que afectaban también a `mis_turnos.html`: (1) una regla `@media (max-width:1024px)` redundante pisaba por orden de cascada las reglas más específicas de `.quick-stats` en mobile (768px/480px) porque aparecía después en el archivo; (2) `.turno-card` y `.proximo-banner` no tenían ningún breakpoint para apilarse en mobile, quedando amontonados. El nombre del hospital en las tarjetas de `mis_turnos.html` todavía envuelve en varias líneas en mobile — es un estilo inline propio de esa página (no de la clase compartida `.turno-card` que se corrigió acá), queda afuera de esta vuelta. *(Nota que fue cierta hasta el 2026-09-10: `registrarDonacion()` ya está conectado — ver "Registrar donación" en Hospital — así que esta pantalla ya puede mostrar donaciones nuevas, no solo las 2 semilla. La atribución anterior de esta nota, que decía que `registrarDonacion()` iba a vivir en "Atención clínica" del Profesional de salud, era incorrecta: vive en `hospital/turnos.html`.)* |
| Formulario post-donación anónimo (F4) | `donante/postdonacion_anonimo.html` | 🟢 | `validarTokenPostdonacion(token)` valida existencia, uso previo y vencimiento (24hs) contra `formulario_postdonacion`; `guardarRespuestaPostdonacion()` persiste la respuesta y marca el token usado. Es la única función de escritura del rol que funciona **sin sesión** (anonimato real: no llama a `HemoRed.sesion` en ningún lado) — probado explícitamente limpiando la sesión activa antes de completarlo. El token se genera al registrar la donación (`registrarDonacion()`, ver Hospital) y se entrega por 2 canales según el contexto: QR (pantalla del profesional → celular del donante, dos dispositivos) y notificación in-app con el link directo (mismo dispositivo, ahí un QR no serviría) — sin mail simulado, decisión explícita de la usuaria. Test: `tests/registrar-donacion.spec.js` (cubre el ciclo completo, no solo esta pantalla sola). | — |
| Notificaciones | `donante/notificaciones.html` | 🟢 | Se adelantó este ítem (estaba después de F4 en el orden sugerido) porque "Solicitudes de corrección" lo necesitaba para el aviso de rechazo — ver esa sección. Tabla nueva `notificaciones_donante` (no reutiliza `mensajes.json`, que es hospital↔admin). `cargarNotificacionesDonante()` (agrupa hoy/ayer/semana/antes contra `AHORA_DEMO`), `marcarNotificacionLeida()`, `marcarTodasNotificacionesLeidas()` reales. Los filtros (que ya eran funcionales sobre contenido fijo) ahora filtran datos reales. Los 6 ejemplos que tenía la pantalla estática se convirtieron en datos semilla reales. Test: `tests/notificaciones.spec.js`. | **Hoy es la única fuente dinámica real: rechazar una solicitud de corrección.** El resto de los ejemplos (turno confirmado, resultado cargado, etc.) sigue siendo semilla estática — ningún otro flujo del sitio genera todavía una notificación real cuando ocurre el evento correspondiente (eso requeriría tocar `confirmarTurno()`, `cargarResultadoAnalisis()`, etc., uno por uno). |
| Editar perfil | `donante/perfil.html` | 🟢 | `actualizarPerfilDonante()`, `actualizarPreferenciasNotificacion()`, `agregarEmpleador()`/`editarEmpleador()`/`eliminarEmpleador()` cableados sobre datos reales de `usuarios.json`. Editar un empleador reutiliza el mismo item de la lista (icono lápiz) con un mini-form inline; valida nombre vacío y nombre duplicado (contra el resto de la lista) antes de guardar, y si falla deja el form abierto con lo ya escrito en vez de cerrarlo. Se agregaron 8 campos nuevos (`experiencia_donante`, `ultima_donacion_fecha`, `ultima_donacion_fecha_aproximada`, `ultima_donacion_lugar`, `condiciones_medicas`, `notif_recordatorio_turno`, `notif_resultado_analisis`, `notif_campanas_urgentes`, ver `docs/01`) y se conectaron Datos personales, Datos médicos, Preferencias de notificaciones y Empleadores. En Datos médicos, si "¿Donaste antes?" es `habitual`/`ocasional` se despliega un bloque para cargar fecha (o fecha aproximada, si no la recuerda) y lugar de esa última donación. Estos campos son del perfil, no confundir con los homónimos del formulario de pre-donación (F2), que se preguntan de nuevo en cada turno. **"¿Donaste antes?" y `tipo_sangre` son de escritura única:** una vez guardados, el perfil bloquea permanentemente el select/grilla correspondiente (con un hint explicando por qué) — mismo tratamiento que el email, porque son datos históricos o pendientes de verificación médica real, no preferencias editables. El nombre/iniciales del sidebar se sincronizan al instante si se edita el nombre (`HemoRed.sesion.actualizarNombreSesion()`), sin necesidad de relogin. Test: `tests/perfil.spec.js`. | Queda afuera de esta vuelta la sección Seguridad (cambiar contraseña/email, eliminar cuenta — acciones más delicadas, requieren su propio diseño de flujo, no solo conexión a datos) y los indicadores "Completo/Pendiente/Opcional" de cada acordeón, que siguen hardcodeados y no reflejan el estado real de cada sección. |

**Estado 2026-08-19:** el camino núcleo del rol donante (buscar campaña → reservar turno → ver el turno en "Mis turnos") ya funciona de punta a punta y tiene test automatizado (ver [`/tests`](../tests)).

**Estado 2026-09-01:** se cerró también "Mis turnos — cancelar/reprogramar" (`actualizarTurno()`, `cancelarTurno()`), con su propio test (`tests/modificar-cancelar-turno.spec.js`). Se resolvió la pregunta abierta que había quedado pendiente: la ventana de 24h/2h aplica igual sobre un turno `pendiente` que sobre uno `confirmado` (mismo motivo de negocio en ambos casos — ver nota en "Mis turnos" de `docs/03`).

**Estado 2026-09-01 (2):** se cerró también "Editar perfil" (`actualizarPerfilDonante()`, `actualizarPreferenciasNotificacion()`, `agregarEmpleador()`/`eliminarEmpleador()`), con su propio test (`tests/perfil.spec.js`). Se resolvió el modelo de datos para "¿donaste antes?": el perfil (`usuarios`) tiene su propia foto general — `experiencia_donante` más, si contestó que sí donó antes, `ultima_donacion_fecha`/`ultima_donacion_fecha_aproximada`/`ultima_donacion_lugar` — editable en cualquier momento y sin relación con los campos homónimos del formulario de pre-donación, que se vuelven a preguntar en cada proceso de donación puntual y todavía no están implementados. Ver el detalle completo y el porqué de mantenerlos separados en `docs/01`.

### Pendiente de diseño: restricciones de elegibilidad para reservar turno (anotado 2026-09-01, no implementado)

Hoy `crearTurno()` solo valida 3 cosas (ver fila de arriba). La usuaria pidió dejar anotado — **sin codear todavía** — un conjunto más amplio de restricciones para habilitar/deshabilitar el botón "Reservar turno", con una leyenda visible explicando el motivo exacto (mismo patrón que ya usan `actualizarTurno()`/`cancelarTurno()` cuando rechazan por la ventana de tiempo, incluyendo el contacto del hospital).

**Casos pedidos explícitamente:**
1. El donante tiene una donación registrada en los últimos **85 días** en la plataforma. *(Ojo: `crearTurno()` ya tiene hoy una regla parecida pero con **90 días**, ver línea de arriba — hay que decidir si son la misma regla con un número a corregir, o si son dos cosas distintas antes de tocar el código.)*
2. El donante ya tiene un turno reservado en la plataforma. *(Hoy `crearTurno()` solo chequea duplicado para la **misma campaña** — no bloquea reservar un segundo turno en una campaña distinta mientras el primero sigue pendiente/confirmado. Definir si el límite es "un turno activo por vez" en toda la plataforma.)*
3. El donante tiene una condición médica que le impide donar, detectada en el análisis de una donación anterior. *(Hoy no hay dónde guardar esto: `resultado_analisis` solo guarda un PDF adjunto, sin campos estructurados — los campos tipo "enfermedades detectadas" están anotados como pendientes de v2 en `docs/01`. `donaciones.apto` existe pero es por-donación puntual, no está claro si alcanza para una inhabilitación permanente o si hace falta un campo nuevo en `usuarios`.)*
4. El donante no cumple la edad (18-65) o el peso mínimo (50kg) cargados en su perfil. *(Hoy estos dos requisitos solo se **muestran como texto** en "Requisitos para donar" — `crearTurno()` no los valida contra `usuarios.fecha_nacimiento`/`usuarios.peso_kg` en ningún lado.)*

**Otros casos que se me ocurren y conviene evaluar antes de definir el alcance final:**
- Cuenta de donante suspendida por administración (`usuarios.activo:false`, o la acción "Suspender" de `admin/donantes.html`, que tampoco está cableada hoy — ver rol Super Admin).
- La campaña ya no admite más turnos: cupo cubierto (`cantidad_donantes` alcanzada), `fecha_limite` vencida, o `estado` distinto de activa (pausada/cerrada). Hoy `crearTurno()` tampoco valida nada de esto del lado de la campaña.
- Ausencias repetidas sin aviso (no-shows) — es más una decisión de producto (¿penalizar? ¿desde cuántas?) que una validación técnica; dejarla marcada como "a evaluar si se quiere", no asumida.
- **Aclaración importante para no confundir con lo de arriba:** el **tipo de sangre NO es una restricción** para reservar turno — se corrigió recién esta misma sesión el copy que decía lo contrario en `campana_detalle.html` (x2) y `nueva_campana.html`, porque no es una restricción real en Argentina. Cualquier donante puede anotarse a cualquier campaña independientemente de su tipo de sangre.

**Sobre la leyenda pedida:** cuando el botón esté deshabilitado por cualquiera de estos motivos, mostrar el motivo específico (no un mensaje genérico tipo "no disponible") — de la misma forma que ya lo hacen los mensajes de error de `actualizarTurno()`/`cancelarTurno()` hoy.

**Estado 2026-09-08:** se cerró también "Completar formularios pre-donación (F1/F2)" (`guardarFormularioConsentimiento()`), con su propio test (`tests/formularios-predonacion.spec.js`). Se corrigió una decisión de esquema mal documentada de una sesión anterior: `formulario_consentimiento` se ancla a `turno_id`, no a `donacion_id` (la donación no existe todavía cuando se completa F1/F2) — ver `docs/01`. Se descartó agregar los campos de "última donación" a este formulario porque es el estándar real de los hemocentros del país y no se modifica; esos campos quedan exclusivamente en el perfil (ya cerrado la vuelta anterior).

**Estado 2026-09-08 (2):** se cerró también "Mis donaciones" (`cargarMisDonaciones()`), con su propio test (`tests/mis-donaciones.spec.js`). Sin preguntas de diseño abiertas — es solo lectura. De paso se corrigieron 2 bugs de responsive reales en `donante.css` (ver fila de arriba) que también mejoraron `mis_turnos.html`, aunque no lo dejaron perfecto del todo (queda una nota en "Qué falta" de esa fila).

**Estado 2026-09-08 (3):** se cerró también "Mis documentos" (`cargarMisDocumentos()` + `solicitarCertificado()`), con su propio test (`tests/mis-documentos.spec.js`). Se corrigió una fila de esquema desactualizada en `docs/01` (`documentos`/`resultado_analisis`/`certificado_donacion` son mucho más ricas de lo que decía la doc — no son PDFs planos, son datos estructurados). Se encontraron y corrigieron 2 bugs reales preexistentes en el HTML: la pestaña "Evaluaciones clínicas" tiraba un error de JS al clickearla (contenido nunca creado), y "Enviar observación" no tenía ningún `onclick`. También 2 bugs de responsive (mismo patrón de cascada de `.quick-stats`, ver más arriba): `.resultado-layout`/`.certificado-layout` no colapsaban en mobile.

**Estado 2026-09-08 (4):** se cerró el flujo completo de "Solicitudes de corrección" (donante + hospital) que había quedado anotado como pendiente de diseño más arriba en esta misma vuelta — ver la sección propia más abajo con el detalle técnico. Test: `tests/solicitudes-correccion.spec.js`.

**Estado 2026-09-08 (5):** se completó el ciclo de vida de "Solicitudes de corrección" con el estado visible del certificado (Emitido/En revisión/Emitido con corrección) y, para eso, se adelantó y cerró también "Notificaciones" (antes 🔴, ver esa fila) — el rechazo de una solicitud ahora genera una notificación real en vez de solo un aviso en el certificado. Tests: `tests/solicitudes-correccion.spec.js` (actualizado) y `tests/notificaciones.spec.js` (nuevo).

**Estado 2026-09-10:** se cerró el último flujo pendiente del rol Donante — "Formulario post-donación anónimo" (F4) — con su propio test de punta a punta, `tests/registrar-donacion.spec.js`. Para que F4 tuviera algo real que validar, hizo falta conectar primero "Registrar donación" (Hospital, `hospital/turnos.html`), que hasta ahora era un modal 100% de mentira: no existía NINGÚN camino en todo el prototipo que creara una donación real, así que "Mis donaciones" solo podía mostrar los 2 registros semilla sin importar qué se probara. Con esto, el rol Donante queda completo salvo los 2 pendientes de diseño ya documentados más abajo (uno de los cuales sigue bloqueado por investigación pendiente de la usuaria). Detalle técnico completo en la fila "Registrar donación" (Hospital) y en la fila "Formulario post-donación anónimo (F4)" (Donante) de arriba.

### Solicitudes de corrección sobre certificados de donación (cerrado 2026-09-08, flujo de 2 roles)

**Es exclusivo de certificados de donación** (los que el donante pide para presentar en una empresa) — **el formulario de consentimiento (F1/F2) NO tiene este flujo.** Son documentos de naturaleza distinta: el consentimiento se firma antes de donar, no es algo que se "solicite" para un tercero. *(Corregido 2026-09-08: una versión intermedia de esta implementación lo había extendido también a consentimiento, siguiendo un diseño de sesión anterior que mencionaba ambos tipos — la usuaria lo corrigió explícitamente, el alcance pedido siempre fue solo certificados.)*

**Origen:** al conectar "Mis documentos", el botón "Enviar observación" quedó funcional del lado del donante pero **no persistía nada** (no existía tabla). Se reemplazó por un flujo completo: modal con un checkbox por cada campo "reportable" del certificado — al marcar uno, se muestra el valor actual (solo lectura) al lado de un campo en blanco para la corrección propuesta — y una pantalla nueva del lado del Hospital para revisar, aprobar (aplica el cambio real) o rechazar (con motivo obligatorio).

**Tabla real: `solicitudes_correccion`** — `id (PK)`, `usuario_id (FK)`, `hospital_id (FK, resuelto del certificado al crear la solicitud)`, `certificado_id (FK a certificado_donacion)`, `campos` (lista de `{ campo, valor_actual, valor_propuesto }`), `estado ('pendiente'|'aprobada'|'rechazada')`, `fecha_solicitud`, `resuelto_por (FK, null hasta resolver)`, `fecha_resolucion (null hasta resolver)`, `motivo_rechazo (null salvo rechazo)`.

**Campos reportables (mapa `CAMPOS_CORREGIBLES` en `js/data.js`, comparte la misma definición entre donante y hospital):** nombre, apellido, DNI (→ `usuarios`), fecha de donación (→ `certificado_donacion`). "Nombre del donante" se separó en `nombre`/`apellido` (dos campos reportables distintos) para que cada uno mapee sin ambigüedad a `usuarios.nombre`/`usuarios.apellido` al aprobar. **Volumen donado, profesional a cargo y hospital NO son reportables** (decisión 2026-09-08): son datos que carga el sistema/hospital en el momento de la donación, el donante no los controla ni puede saber si están mal desde su lugar. De paso, "Volumen donado" tampoco se muestra ya en la vista del certificado del donante (no era un dato que correspondiera mencionar ahí).

**Nombre y DNI siguen siendo reportables acá aunque viven en `usuarios` (el perfil), no en el certificado puntual** — se mantuvo la decisión original: un solo lugar donde el donante reporta cualquier error, en vez de mandarlo a editar el perfil por separado. Al aprobar, el cambio se aplica igual sobre `usuarios`.

**Qué hace `HemoRed.data.resolverSolicitudCorreccion()` al aprobar:** agrupa los campos marcados por tabla de destino (`usuarios` o `certificado_donacion`) y aplica cada uno con `HemoRed.db.actualizar()` — no alcanza con marcar la solicitud como aprobada, el dato cambia de verdad. Mientras una solicitud sigue `pendiente` para un certificado, no se puede mandar una segunda para el mismo (se rechaza con un error).

**Estado visible del certificado (agregado 2026-09-08, segunda vuelta):** no es un campo nuevo en `certificado_donacion` — se calcula al vuelo contra la última solicitud de ese certificado (`ultimaSolicitudCertificado()` en `mis_documentos.html`). 3 estados, badge en la lista de "Mis documentos" + detalle:
- Sin solicitud, o última `rechazada` → **"Emitido"** (rechazar no deja marca: el certificado no cambió, vuelve a la normalidad).
- `pendiente` → **"En revisión"**.
- `aprobada` → **"Emitido con corrección"**.

En cualquiera de los 3 estados, el detalle del certificado muestra el desglose completo de la última solicitud (cada campo reportado, valor actual tachado vs. propuesto), la fecha y hora en que se solicitó (`fecha_solicitud`) y, si ya se resolvió, la fecha y hora de la resolución (`fecha_resolucion`) — ambos campos ya existían en la tabla desde el diseño original, solo faltaba mostrarlos. No se pierde el historial del pedido aunque ya esté resuelta. Mientras hay CUALQUIER solicitud registrada (pendiente, aprobada o rechazada), no aparece un botón para reportar de nuevo — solo aparece "Reportar dato incorrecto" si el certificado nunca tuvo ninguna solicitud.

**Del lado del donante** (`mis_documentos.html`): el botón "Reportar dato incorrecto" reemplaza al viejo "Enviar observación", solo en la vista de certificado (la vista de consentimiento no tiene ningún botón de este tipo).

**Del lado del hospital** (`hospital/documentacion.html`): se agregó una 3ª pestaña "Solicitudes de corrección" (con badge de pendientes) a la misma pantalla existente, en vez de crear un archivo nuevo. `cargarSolicitudesCorreccion()` resuelve el hospital logueado igual que ya lo hace `cargarDashboardHospital()` (`usuarios.hospital_id`). El modal de revisión muestra cada campo tachado (actual) vs. propuesto, y exige motivo para rechazar.

**Al rechazar, se genera una notificación real** en la tabla nueva `notificaciones_donante` (ver esa fila en Donante y `docs/01`) con el mismo motivo que el hospital escribió al rechazar — reutiliza el apartado "Notificaciones" que ya estaba planeado como próximo hito del donante, en vez de inventar un mecanismo de aviso aparte. El certificado en sí también deja ver el mensaje "Corrección no aplicada" con un botón "Ver notificaciones". **Pendiente para más adelante, decisión explícita de la usuaria:** que el hospital pueda redactar un mensaje libre (tipo mail) en vez de que la notificación solo repita el motivo del rechazo — hoy no hace falta, porque el motivo que ya escribe al rechazar alcanza para generar la notificación automáticamente.

Test: `tests/solicitudes-correccion.spec.js` (aprobación de principio a fin verificando que el dato realmente cambia en `certificado_donacion` y que el badge pasa a "Emitido con corrección"; rechazo con motivo verificando que el certificado NO cambia, el badge vuelve a "Emitido", y la notificación real aparece en `notificaciones.html`; y un caso explícito confirmando que consentimiento no ofrece este botón). Ver también `tests/notificaciones.spec.js`.

### Pendiente de diseño: recordatorio de F4 si el donante no responde (anotado 2026-09-10, no implementado)

**Qué falta resolver:** hoy, al registrar la donación, el token de F4 se entrega una sola vez, por 2 canales simultáneos (QR en la pantalla del profesional + notificación in-app) — ver "Registrar donación" y "Formulario post-donación anónimo (F4)" más arriba. Si el donante no completa el formulario ni escaneando el QR en el momento ni por la notificación después, hoy no hay ningún reintento ni recordatorio — el token simplemente sigue disponible hasta que vence (24hs) y ya.

**Idea de la usuaria, a diseñar más adelante:** si pasaron 2 horas desde que el profesional generó el QR y el donante todavía no respondió el formulario, reforzar el aviso — por notificación in-app de nuevo, o por mail — dado que en ese punto ya no se puede asumir que el QR sigue "a mano" (el donante ya se fue del consultorio con su propia oportunidad de escanearlo).

**Preguntas a resolver cuando se aborde (no respondidas todavía):**
- ¿Cómo se detecta el vencimiento de esa ventana de 2hs sin backend real? El prototipo no tiene ningún proceso corriendo en segundo plano (cron, worker) — habría que decidir si esto se simula solo visualmente (ej. al entrar a alguna pantalla del donante, chequear si hay un F4 pendiente hace más de 2hs y mostrar un recordatorio ahí) o si se documenta como un caso que directamente necesita backend real para funcionar de verdad.
- Si se agrega mail como canal de refuerzo, mismo tema que ya quedó pendiente para "Solicitudes de corrección": el prototipo nunca simuló un envío de mail real — decidir si acá tampoco corresponde simularlo, o si este caso amerita hacer la excepción (a diferencia del rechazo de una corrección, acá el mail sería la ÚNICA forma de reforzar el aviso si el donante ya cerró la app — la notificación in-app por sí sola no "empuja" nada si no vuelve a abrir la app).
- ¿Quién dispara el recordatorio? ¿Se revisa cada vez que el donante entra a alguna pantalla (chequeo pasivo), o hace falta algo más proactivo?

No implementar nada de esto sin retomar el diseño primero — queda anotado como idea, no como especificación.

### Pendiente de diseño: validación de email y DNI del donante (anotado 2026-09-08, sin investigar todavía)

**Qué falta resolver:** hoy el registro de un donante acepta cualquier email y cualquier DNI sin ninguna verificación real — no se confirma que el email sea válido/propio (no hay verificación por link ni por código), y el DNI no se valida más allá de lo que ya pide el formulario como texto.

**Estado: pendiente de investigación, todavía no de diseño.** La usuaria pidió explícitamente dejarlo anotado como un hito más para cerrar el perfil del donante, pero aclaró que antes de proponer cualquier diseño hace falta investigar qué herramientas/servicios existen para esto — no armar una solución de una.

Preguntas que esa investigación va a tener que responder (anotadas para no perderlas, no resueltas todavía):
- **Email:** ¿verificación por link con token (mismo patrón que ya existe para `formulario_postdonacion.token`, con expiración) o por código numérico? ¿Con qué se enviaría el mail, dado que el prototipo no tiene backend real todavía?
- **DNI:** ¿alcanza con validar el formato, o se busca integrar algo como RENAPER (el padrón nacional en Argentina) para confirmar identidad de verdad? Esto último implica costo, cuestiones de privacidad y disponibilidad de API que hay que investigar antes de decidir si es viable para este proyecto.
- **Alcance para el prototipo actual:** sin backend real, es probable que esto termine siendo una simulación visual del flujo (como ya se hizo con login/registro) en vez de una integración real — pero es una decisión a tomar después de investigar, no antes.

Es el último hito que le falta al perfil del donante para considerarlo completamente cerrado — queda bloqueado hasta que haya una investigación concreta para discutir, no se avanza en código mientras tanto.

### Rol Donante: completo (salvo 2 pendientes de diseño)

**Estado 2026-09-10:** no queda ningún flujo del rol Donante sin conectar. Lo único pendiente son los 3 ítems ya documentados más arriba:
- **Validación de email y DNI** — bloqueado hasta que la usuaria traiga la investigación que dijo que iba a hacer (qué herramientas/servicios existen). No avanzar en diseño ni código mientras tanto.
- **Restricciones de elegibilidad para reservar turno** — pendiente de diseño, sin bloqueo — se puede retomar cuando se quiera.
- **Recordatorio de F4 si el donante no responde en 2hs** (anotado 2026-09-10) — pendiente de diseño, sin bloqueo.

De paso, al cerrar F4 se conectó también "Registrar donación" del lado del **Hospital** (`hospital/turnos.html`) — no es un ítem de Donante, pero fue necesario tocarlo para que F4 tuviera algo real que validar (ver esa fila en la sección Hospital más abajo).

Los otros roles con flujos sin conectar son Hospital (el resto, fuera de "Registrar donación"), Super Admin y Profesional de salud (v2) — ver sus tablas más abajo en este mismo documento.

## Matriz de dependencias entre roles

**Por qué existe esto:** varias pantallas ya cerradas (de cualquier rol) son de solo lectura, o de validación, sobre tablas que **otro rol distinto es el único que puede escribir**. Cerrar una pantalla no hace que el dato varíe — el rol que lee puede ver/usar lo que exista, y hoy existe poco porque casi ningún flujo de escritura de Hospital, Profesional o Super Admin está conectado todavía. Esta matriz evita dos errores: (a) pensar que una pantalla de solo lectura recién cerrada "no funciona" porque no trae datos nuevos, y (b) al cerrar una pantalla de escritura, olvidarse de que hay otra pantalla ya cerrada (de otro rol) que va a empezar a mostrar datos reales gracias a eso.

**Verificado contra el código real (2026-09-10), última revisión tras cerrar F4 + "Registrar donación"** — existen funciones de escritura reales para: `usuarios` (Donante, su propio perfil/registro; Hospital, al aprobar una corrección de nombre/apellido/DNI de un certificado), `turnos` (Donante crea, Hospital confirma/rechaza/completa vía `registrarDonacion()`), `formulario_consentimiento` (Donante, F1/F2 — sin escritura de Hospital, "Solicitudes de corrección" es exclusivo de certificados), `donaciones` (Hospital, `registrarDonacion()`), `certificado_donacion` (Hospital, al aprobar una corrección de sus campos), `solicitudes_correccion` (Donante crea, Hospital resuelve), `notificaciones_donante` (Hospital, al rechazar una corrección o al registrar una donación) y `formulario_postdonacion` (Hospital genera el token, Donante responde sin sesión). Ninguna otra tabla (`campanas`, `hospitales`, `documentos`, `resultado_analisis`, `mensajes`, `profesionales`, `facturas`, etc.) tiene una sola función que la escriba en ningún rol — son 100% datos semilla estáticos hasta que se conecte alguna.

| Tabla | Quién escribe (función, estado) | Quién lee (pantalla, estado) |
|---|---|---|
| `campanas` | Nadie. Hospital: `publicarCampana()` en el wizard de 3 pasos — 🔴 sin implementar (paso 1 ni siquiera navega). | Donante: `dashboard.html`/`campana_detalle.html` — 🟢 conectado. Hoy solo ve las 4 campañas semilla. |
| `hospitales` | Nadie. Hospital: editar perfil — 🔴. Super Admin: aprobar/suspender — 🔴. | Donante: dashboard, turnos, formularios (nombre/ciudad del hospital) — 🟢 conectado, solo lectura. |
| `turnos` | Donante: `crearTurno()`/`actualizarTurno()`/`cancelarTurno()` — 🟢. Hospital: `confirmarTurno()`/`rechazarTurno()` — 🟢 (corregido hoy, estaba mal marcado). | Donante — 🟢. Hospital (dashboard + `turnos.html`) — 🟢/🟡. Profesional (`cargarTurnosProfesional()`) — 🟡 lectura silenciosa: la función trae los datos bien, pero el HTML no tiene los `id` para mostrarlos. |
| `usuarios` | Donante: registro + `actualizarPerfilDonante()` — 🟢 (su propio registro). Hospital: `resolverSolicitudCorreccion()` — 🟢 (solo nombre/apellido/DNI, si el donante los reportó y el hospital aprobó). Super Admin: suspender/reactivar donante — 🔴 sin implementar. | Donante — 🟢. Hospital/Profesional (para mostrar nombre/DNI del donante en un turno) — 🟢/🟡. Super Admin (`cargarDashboardAdmin()`, stats) — 🟡 lectura silenciosa. |
| `donaciones` | Hospital: `registrarDonacion()` en `turnos.html` — 🟢 (corregido 2026-09-10 — antes decía que esto vivía en "Atención clínica" del Profesional y que no persistía nada; ninguna de las dos cosas era cierta después de conectarlo). | Donante (`crearTurno()` regla 90 días, `cargarMisDonaciones()`) — 🟢, ya deja de mostrar solo los 2 registros semilla. Hospital/Super Admin (dashboards) — 🟡 lectura silenciosa. |
| `formulario_consentimiento` | Donante: `guardarFormularioConsentimiento()` (F1+F2) — 🟢. Profesional: F3 (evaluación clínica, extendería el mismo registro con `donacion_id`/firmas del profesional) — 🔴 no implementado. *(No tiene escritura de Hospital: "Solicitudes de corrección" es exclusivo de certificados, ver esa sección más arriba.)* | Donante: `cargarMisDocumentos()` (pestaña Consentimientos) — 🟢. |
| `documentos` | Nadie. Hospital: `cargarResultadoAnalisis()`/`emitirCertificado()` — 🔴. Donante: `solicitarCertificado()` — 🟢 (crea un documento "pendiente", no un certificado real). | Donante: `cargarMisDocumentos()` — 🟢 (las 4 pestañas). |
| `resultado_analisis` | Nadie. Hospital: `cargarResultadoAnalisis()` — 🔴. | Donante: `cargarMisDocumentos()` (pestaña Resultados) — 🟢. |
| `certificado_donacion` | Nadie crea uno nuevo (Hospital: `emitirCertificado()` — 🔴). Hospital: `resolverSolicitudCorreccion()` — 🟢 (corrige campos de un certificado ya existente, no crea uno). | Donante: `cargarMisDocumentos()` (pestaña Certificados) — 🟢. |
| `solicitudes_correccion` | Donante: `crearSolicitudCorreccion()` — 🟢. Hospital: `resolverSolicitudCorreccion()` (aprobar/rechazar) — 🟢. | Donante: `mis_documentos.html` (estado de su propia solicitud) — 🟢. Hospital: `cargarSolicitudesCorreccion()` (3ª pestaña de `documentacion.html`) — 🟢. |
| `notificaciones_donante` | Nadie escribe notificaciones "genéricas" todavía (turno confirmado, resultado cargado, etc. siguen siendo semilla). Hospital: `resolverSolicitudCorreccion()` (rechazo de corrección) y `registrarDonacion()` (aviso de F4) — 🟢, únicos 2 casos reales hoy. | Donante: `cargarNotificacionesDonante()` (`notificaciones.html`) — 🟢. |
| `formulario_postdonacion` | Hospital: `registrarDonacion()` genera el token — 🟢. Donante: `guardarRespuestaPostdonacion()` — 🟢, sin sesión (anónimo, ver `postdonacion_anonimo.html`). | Donante: `validarTokenPostdonacion()` en la misma pantalla — 🟢. Nadie más lee esta tabla todavía (el personal del banco de sangre que consulta las respuestas es v2, no existe pantalla). |
| `mensajes` | Nadie. Hospital y Super Admin — 🔴 en ambos lados. | Nadie todavía. |
| `profesionales` | Nadie. Hospital: `crearProfesional()`/`desvincularProfesional()` — 🔴. | Profesional (resolver quién está logueado) — 🟡 parcial. |

**Cómo usar esta tabla al retomar cualquier flujo (agregado como paso del flujo estándar, ver memoria del proyecto):** antes de cerrar una pantalla, identificar qué tabla(s) lee y escribe. Si lee una tabla que otro rol escribe, buscarla acá para saber si esa escritura ya está conectada (si no lo está, "no aparecen datos nuevos" es esperable, no bug). Si escribe una tabla que otro rol lee, después de cerrarla volver a esta tabla y actualizar el estado de esa fila — puede que eso destrabe una pantalla ya cerrada de otro rol que hasta ahora solo mostraba datos semilla.

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
| Gestionar turnos del día | `hospital/turnos.html` | 🟢 | *(fila corregida 2026-09-08 — estaba desactualizada, esto ya se cerró junto con el camino feliz donante-hospital, ver "Estado 2026-08-19".)* `cargarTurnosHoy()` cableado al render real. `confirmarTurnoUI()`/`rechazarTurnoUI()`/`confirmarTodosPendientes()` llaman a `HemoRed.data.confirmarTurno()`/`rechazarTurno()` de verdad y actualizan la lista. Es la contraparte de "Reservar turno" del donante — sin esto, un turno se quedaría en `pendiente` para siempre. | — |
| Registrar donación | `hospital/turnos.html` (modal) | 🟢 | `registrarDonacion(turnoId, {...})` crea el registro real en `donaciones` (número de bolsa autogenerado, profesional real seleccionado — antes el select tenía 4 nombres hardcodeados, 3 de los cuales ni existían en `profesionales.json`), actualiza el turno a `completado`, y genera el token de F4 + la notificación in-app al donante (ver esa fila en Donante). **También se corrigió el criterio de cuándo aparece el botón:** antes decía `turno.estado === 'completado'` (el estado AL QUE se llega después de registrar, nunca antes de eso — el botón no podía aparecer nunca en un caso real). Ahora aparece cuando el turno está `confirmado` y el donante ya completó F1/F2, y solo si todavía no hay una donación para ese turno. Signos vitales (presión, hemoglobina, etc.) quedan sin cargar acá a propósito — son responsabilidad de la evaluación clínica (F3), un flujo propio de Profesional de salud que sigue sin conectar (ver esa sección). Test: `tests/registrar-donacion.spec.js`. | — |
| Cargar resultado de análisis | `hospital/documentacion.html` (modal) | 🔴 | Mismo patrón: "Cargar resultado" = "Cancelar". Lista de pendientes/cargados es fija. | `cargarResultadoAnalisis({...})`: crea en `resultado_analisis` **y además** en `documentos` (si no, el donante nunca lo ve en "Mis documentos" — ya conectado del lado del donante, ver esa fila). **Pendiente de diseño (2026-09-01, dato agregado 2026-09-08):** cuando se implemente esto, decidir si acá también se confirma/corrige `usuarios.tipo_sangre` (autoreportado y bloqueado desde el perfil del donante, ver `docs/01`) contra el resultado real del análisis. El dato para hacerlo ya existe: `resultado_analisis.grupo_sanguineo`/`factor_rh` están en el fixture real (confirmado al conectar "Mis documentos") — falta solo la lógica que compare/actualice, no el campo. |
| Emitir certificado de donación | `hospital/documentacion.html` (modal) | 🔴 | Mismo patrón: "Emitir certificado" = "Cancelar". | `emitirCertificado({...})`: crea en `certificado_donacion` + `documentos` (mismo motivo dual que arriba). |
| Revisar solicitudes de corrección | `hospital/documentacion.html` (3ª pestaña + modal) | 🟢 | Exclusivo de certificados de donación (no de consentimientos). `cargarSolicitudesCorreccion()` trae las solicitudes reales del hospital logueado con el donante resuelto; `resolverSolicitudCorreccion()` aprueba (aplica el/los campo(s) corregido(s) sobre `usuarios` o `certificado_donacion`, según corresponda) o rechaza con motivo obligatorio. Ver sección "Solicitudes de corrección..." en Donante para el detalle completo del modelo de datos. Test: `tests/solicitudes-correccion.spec.js`. | — |

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
