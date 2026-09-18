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

**`modificar-cancelar-turno.spec.js`** — el segundo bloque de Donante, agregado 2026-09-01, ajustado 2026-09-16:

1. Un turno reservado con más de 24hs de anticipación se puede reprogramar (nueva fecha/horario) y después cancelar sin problema.
2. Un turno para el que ya venció la ventana de tiempo (2hs para cancelar, 24hs para reprogramar) se rechaza con el motivo de negocio explicado y el contacto del hospital — no con un error genérico. Desde que "hoy" pasó a ser la fecha real (ver `docs/04`, "Fecha 'hoy' del prototipo"), este caso arma el turno directo contra la fecha/hora real menos 1 hora (`HemoRed.db.crear`) en vez de reservarlo por la pestaña "hoy" de la UI — así no depende de en qué momento del día real corra el test (a la mañana temprano, el primer horario de la grilla de "hoy" todavía podría estar a más de 2hs de distancia).

**`perfil.spec.js`** — "Mi perfil" del donante, agregado 2026-09-01:

1. Un donante recién registrado (perfil vacío) edita Datos personales, Datos médicos (tipo de sangre, peso, "¿donaste antes?", condiciones médicas), Preferencias de notificaciones y agrega/elimina un empleador frecuente.
2. Todo lo guardado persiste después de recargar la página (leído de vuelta desde `localStorage`, no solo del estado en memoria de la página).
3. El nombre que se ve en el sidebar se actualiza al instante al cambiar el nombre en el perfil, sin necesidad de volver a loguearse (ver `HemoRed.sesion.actualizarNombreSesion()`).
4. El bloque "Sobre tu última donación" (fecha, fecha aproximada, lugar) solo aparece si "¿Donaste antes?" es `habitual` u `ocasional`. Antes de guardar por primera vez se puede alternar libremente entre fecha exacta y "no recuerdo la fecha exacta" (mutuamente excluyentes). Una vez guardado, "¿Donaste antes?" y sus 3 campos asociados quedan bloqueados de forma permanente (es un dato histórico, no una preferencia — mismo tratamiento que el email) — se prueba que los 5 controles queden `disabled` y que un segundo guardado (ej. de otro campo médico) no los toque. El hint que aclara qué pregunta "¿Donaste antes?" (donaciones previas al registro en HemoRed) se prueba que siga visible incluso bloqueado.
5. Tipo de sangre sigue el mismo criterio de escritura única: se puede elegir libremente hasta el primer guardado, y después la grilla queda bloqueada (clickear otra opción no cambia nada) — se prueba con la cuenta demo (que ya tiene tipo de sangre cargado) y con un registro nuevo.
6. Empleadores frecuentes: además de agregar/eliminar, se puede **editar** el nombre de uno ya guardado (ícono lápiz, mini-form inline con el nombre actual precargado). Se prueba que el cambio persista tras recargar, que "Cancelar" no guarde nada, y que intentar renombrar a un nombre que ya usa otro empleador se rechace (el form queda abierto con lo escrito, no se pierde ni se cierra solo).

**`formularios-predonacion.spec.js`** — Formularios pre-donación (F1 autoexclusión + F2 cuestionario médico), agregado 2026-09-08, reescrito 2026-09-15:

1. El turno real se carga desde la URL (`?turno_id=`) y el banner muestra sus datos reales, no el texto fijo que tenía antes esta pantalla.
2. El botón del paso 1 sigue bloqueado hasta tildar los 3 checkboxes **y** firmar — se prueban los estados intermedios, no solo el final.
3. **El cuestionario médico (paso 2) arranca sin ninguna pregunta contestada** (corregido 2026-09-15 — antes venían con "No" pre-marcado desde el HTML) y "Confirmar y enviar formularios" (`#btn-paso2`) queda deshabilitado hasta contestar las 34 **y** firmar F2 — se prueba explícitamente que no haya ningún `.excl-btn.sel-si`/`.sel-no` al cargar.
4. Al guardar, se verifica directamente contra `localStorage` que se persistieron: las dos firmas (F1 y F2 son firmas distintas, en momentos distintos), las 34 respuestas del cuestionario, las observaciones, y que `donacion_id` quedó en `null` (la donación todavía no existe en este punto del flujo, la crea el profesional más adelante).
5. "Mis turnos" refleja el estado completado en sus badges después de guardar.
6. **Volver a entrar al mismo turno lo muestra en modo solo lectura, no editable** (corregido 2026-09-15 — antes se podía reenviar libremente y pisar la respuesta): las respuestas, observaciones, checks y ambas firmas se restauran visualmente, pero clickear una pregunta ya contestada no cambia nada (`excl()` corta apenas detecta `soloLectura`), los checks y el textarea quedan `disabled`/`readonly`, el aviso de solo lectura está visible, y "Confirmar y enviar formularios" queda deshabilitado con el texto "Cuestionario ya enviado". Se confirma que no se creó ni se pisó ningún registro nuevo en `formulario_consentimiento`.

**`mis-donaciones.spec.js`** — "Mis donaciones" del donante (solo lectura), agregado 2026-09-08, ajustado 2026-09-16:

1. Con la cuenta demo (que tiene una donación real en los datos semilla, fechada 17/05/2026 a propósito sin tocar), las estadísticas y la tarjeta del historial muestran datos reales, no el contenido fijo que tenía antes esta pantalla.
2. **El banner de "próxima fecha habilitada" ya NO se muestra para la cuenta demo** — desde que "hoy" es la fecha real del sistema (ver `docs/04`), esa donación de mayo 2026 quedó afuera de los 90 días hace rato, así que el banner correctamente no aparece más para ella (antes el test esperaba verlo con el texto fijo "15 de agosto de 2026").
3. La ventana de 90 días sigue siendo la misma que usa `crearTurno()` — se prueba con un donante fresco cuya donación se crea a propósito "hace 30 días" (dentro de la ventana), y se verifica que el banner muestre la fecha exacta (calculada en el test, no un texto fijo).
4. Los filtros de año/resultado, que ya eran funcionales antes sobre contenido fijo, siguen funcionando sobre las tarjetas reales.
5. Un donante recién registrado (sin ninguna donación) ve el estado vacío correctamente, sin errores ni datos de otro donante.

**`mis-documentos.spec.js`** — "Mis documentos" del donante (3 pestañas: Resultados, Evaluaciones clínicas, Certificados), agregado 2026-09-08, reducido de 4 a 3 pestañas el 2026-09-15:

1. Cada pestaña muestra datos reales de la cuenta demo — `documentos` es solo un índice, así que se prueba que el detalle traiga bien el join contra `resultado_analisis`/`certificado_donacion`/`donaciones`.
2. **"Evaluaciones clínicas" estaba rota antes de este cambio** (tiraba un error de JS al clickear la pestaña) — el test explícitamente escucha errores de página y falla si aparece alguno, para no volver a dejarla rota sin darse cuenta.
3. "Reportar dato incorrecto" (reemplazó al viejo "Enviar observación", que no persistía nada) abre el modal de solicitud de corrección — el flujo completo de aprobación/rechazo se prueba en `solicitudes-correccion.spec.js`, acá solo se confirma que el botón abra el modal correcto.
4. Solicitar un certificado nuevo (caso que no existe en los datos semilla — ambas donaciones demo ya tienen certificado, así que el test lo fuerza borrando el documento existente vía `localStorage`) lo deja "Pendiente", y pedirlo dos veces se rechaza.

**Ya no hay pestaña "Consentimientos"** (sacada 2026-09-15, a pedido de la usuaria): mostraba el formulario F1/F2 como un documento aparte para consultar después, pero por cada donación ya se declara el estado de salud y la voluntad de donar en F1/F2 mismo — no sumaba nada archivarlo de nuevo acá. El formulario en sí sigue existiendo igual (ver `formularios-predonacion.spec.js`), solo dejó de mostrarse en esta pantalla.

**`solicitudes-correccion.spec.js`** — flujo completo de "Solicitudes de corrección" sobre **certificados de donación** (donante + hospital), agregado 2026-09-08. **Es exclusivo de certificados** — el formulario de consentimiento no tiene este flujo (son documentos de otra naturaleza, se firman antes de donar, no se "solicitan" para un tercero):

1. El donante marca un campo del certificado como incorrecto (ej. "Apellido"), escribe la corrección propuesta y la envía — se prueba que mandarla sin completar el valor propuesto se rechace, que "Volumen donado"/"Profesional a cargo"/"Hospital" no aparezcan como opciones reportables (son datos que carga el sistema, no algo que el donante controle), y que mientras quede "pendiente" no se pueda mandar una segunda solicitud para el mismo certificado (`crearSolicitudCorreccion()` la rechaza).
2. **Estado visible del certificado** (badge en la lista + detalle, calculado contra la última solicitud, no un campo nuevo): al enviar la solicitud pasa a "En revisión"; si el hospital aprueba, a "Emitido con corrección" (y se verifica el dato real cambiado en `certificado_donacion`); si rechaza, vuelve a "Emitido" sin marca (y se verifica que el DNI original NO cambió). En cualquier estado, el detalle sigue mostrando el desglose completo de la solicitud (no se pierde el historial del pedido).
3. El hospital ve la solicitud en la 3ª pestaña de `hospital/documentacion.html` ("Solicitudes de corrección"), con el badge de pendientes actualizado, revisa el modal (dato actual tachado vs. corrección propuesta) y aprueba o rechaza (exige motivo para rechazar).
4. Al rechazar, se prueba que se genere una **notificación real** (no solo un aviso en el certificado): el botón "Ver notificaciones" del certificado lleva a `notificaciones.html` y ahí aparece la notificación sin leer con el motivo exacto que escribió el hospital.

*(El caso que probaba explícitamente que "Consentimientos" no tuviera botón "Reportar dato incorrecto" se sacó el 2026-09-15 junto con la pestaña entera — ver `mis-documentos.spec.js` — la garantía queda estructural: ese botón solo existe en `verCertificado()`.)*

**`notificaciones.spec.js`** — "Notificaciones" del donante, agregado 2026-09-08 (pasó de ser 100% estática a leer datos reales, adelantada junto con "Solicitudes de corrección" porque el aviso de rechazo la necesitaba), ajustado 2026-09-16:

1. Los 6 ejemplos que antes eran HTML fijo ahora son datos semilla reales (`frontend/db/notificaciones_donante.json`). Están fechados en mayo 2026 (van con la donación real de la cuenta demo, que tampoco se tocó) — contra la fecha real de hoy, los 6 caen en un solo grupo, "Más antiguas", no en Hoy/Ayer/Esta semana.
2. **Caso nuevo, con un donante fresco:** se crean notificaciones a propósito con fecha real de hoy/ayer/hace 4 días/hace 30 días (`HemoRed.db.crear`, usando offsets de día de calendario para no depender de la hora exacta en que corra el test) y se confirma que caen en los grupos Hoy/Ayer/Esta semana/Más antiguas correctamente — así se sigue probando la agrupación de verdad, ahora contra la fecha real del sistema en vez de la fecha fija de demo que usaba antes.
3. Los filtros por tipo ("Documentos", etc.) y "No leídas" — que ya eran funcionales sobre contenido fijo — ahora filtran datos reales.
4. Clickear una notificación la marca como leída de verdad (persiste tras recargar la página); "Marcar todas como leídas" hace lo mismo para todas.

**`registrar-donacion.spec.js`** — "Registrar donación" (Hospital) + formulario post-donación anónimo F4 (Donante), agregado 2026-09-10. **Cierra el rol Donante** (era el único flujo que quedaba sin conectar) — y de paso conecta "Registrar donación" en Hospital, que hasta esa fecha era un modal 100% de mentira (el botón "Confirmar donación" llamaba a la misma función que "Cancelar", y ningún flujo del prototipo creaba una donación real):

1. Camino completo de punta a punta: un donante se registra, reserva un turno para HOY (necesario para que aparezca en "Gestión de turnos"), el hospital lo confirma, el donante completa F1/F2 — recién ahí aparece "Registrar donación" del lado del hospital (antes de eso, ni con el turno confirmado). El select de profesionales trae datos reales de `profesionales.json` (antes tenía 4 nombres hardcodeados, 3 de los cuales no existían).
2. Registrar la donación crea el registro real en `donaciones`, pasa el turno a `completado`, y muestra un QR (generado client-side con `qrcode-generator`) para que el donante lo escanee — se verifica que el `<img>` del QR se renderiza, y que los datos de la donación quedaron bien guardados.
3. El donante recibe una **notificación in-app real** (no un QR — ver la nota sobre por qué cada canal es para un dispositivo distinto) con el link directo al formulario F4; se extrae el token real desde ahí.
4. **F4 se completa sin sesión de verdad:** se limpia `sessionStorage` (simulando un visitante anónimo, sin perder el `localStorage` que hace falta para verificar la persistencia después) y se confirma que la página igual valida el token y guarda la respuesta.
5. El token es de un solo uso: se prueba que reusarlo después de completado se rechace.
6. Casos aparte, sin necesitar todo el flujo previo (se arman directo contra la tabla): token inexistente, token ya usado y token vencido — cada uno muestra su propio mensaje de error, sin excepciones de JS.

*(Actualizado 2026-09-15: como el cuestionario médico F2 ya no trae respuestas por default, este test ahora contesta las 34 preguntas explícitamente antes de firmar — ver `formularios-predonacion.spec.js` para el detalle de ese cambio.)*

**`restricciones-elegibilidad.spec.js`** — restricciones de elegibilidad para reservar turno, agregado 2026-09-10, ampliado 2026-09-14 tras una auditoría de consistencia en todo el rol Donante, y de nuevo 2026-09-16:

1. Un donante recién registrado, sin fecha de nacimiento ni peso cargados en el perfil, no queda bloqueado por default — los requisitos no validables (falta el dato) se mantienen en verde, no se asume incumplimiento.
2. Menor de 18 años: el ítem de edad en "Requisitos para donar" se marca en rojo y "Reservar turno" queda deshabilitado de entrada (antes de llegar a elegir fecha/hora), con el motivo puntual visible.
3. **Tope de edad 65, hasta 70 para donantes habituales**: se prueba el mismo donante (67 años) bloqueado como donante normal y habilitado al marcarlo `experiencia_donante: 'habitual'` — el checklist muestra el tope real en cada caso, no un texto fijo.
4. Menos de 50kg: mismo patrón para el ítem de peso — y se prueba que los chequeos no se crucen (edad sigue en verde si solo falla el peso).
5. **Un turno activo en OTRA campaña también bloquea** — antes el chequeo solo miraba la misma campaña, y ni siquiera consideraba un turno `pendiente` como bloqueante (bug real encontrado al tocar este código, corregido de paso). Se prueba tanto desde la UI como llamando directo a `crearTurno()`.
6. **Reprogramar un turno (`actualizarTurno()`) re-valida elegibilidad completa, no solo la ventana de 24hs** — se prueba bajando el peso a menos de 50kg *después* de reservar: reprogramar a una fecha nueva se rechaza; con el peso corregido, reprograma sin problema (y no se bloquea contra su propio turno activo).
7. **El dashboard muestra un banner único arriba de todo** (no un indicador por tarjeta) cuando el donante no es elegible — con el motivo puntual visible.
8. **Ningún donante de los datos semilla tiene más de un turno activo a la vez** — chequeo de consistencia de datos, no de UI. Se agregó después de encontrar que la cuenta demo violaba esta misma regla (turno 3, duplicado huérfano del turno 6 ya completado, quedó en `en_curso` para siempre — ver `docs/04`), lo que hacía fallar la modificación de un turno real con un mensaje engañoso ("ya tenés un turno activo" en vez del motivo real).
9. **Fechas de nacimiento y de turnos calculadas en runtime, no hardcodeadas** — desde que "hoy" pasó a ser la fecha real del sistema (ver `docs/04`, "Fecha 'hoy' del prototipo"), los `fecha_nacimiento: '1959-01-01'`/turnos `'2026-06-01'` que este archivo tenía hardcodeados hubieran quedado mal (las edades habrían cambiado con el paso del tiempo real, y esas fechas de turno ya habrían quedado en el pasado). Se agregaron 2 helpers (`fechaNacimientoParaEdad(edad)`, `diasDesdeHoy(n)`) que calculan todo relativo al momento real en que corre el test.

**`seguridad-cuenta.spec.js`** — sección "Seguridad de la cuenta" del perfil del donante (cambiar contraseña, cambiar email, eliminar cuenta), agregado 2026-09-15 — hasta esa fecha los 3 botones no tenían ninguna acción (hallazgo de la segunda auditoría de consistencia, ver `docs/04`):

1. Cambiar contraseña rechaza la contraseña actual incorrecta y una confirmación que no coincide con la nueva; al tener éxito, actualiza el resumen ("Última modificación: ...") y la nueva contraseña sirve para volver a loguearse (se prueba que la vieja ya no funcione).
2. Cambiar email rechaza un formato inválido y el mismo email ya actual; al tener éxito, actualiza `#perfil-email` y deja el resumen en "Pendiente de verificación" (no hay forma de mandar/confirmar un link real sin backend, ver `docs/04`).
3. Eliminar cuenta rechaza la contraseña incorrecta; al tener éxito, cierra la sesión y el email queda bloqueado para futuros logins (mensaje "Esta cuenta fue eliminada.", en vez del texto genérico fijo que mostraba antes `login.html` para cualquier error).
4. Se registra un donante nuevo para todo el test (no la cuenta demo hardcodeada): el login de esas 4 cuentas fijas de `sesion.js` no consulta `usuarios.password_hash` en absoluto, así que cambiar la contraseña o el email ahí no tendría ningún efecto observable.

**`select-personalizado.spec.js`** — el componente que reemplaza a todos los `<select>` nativos del sitio por un botón + panel propio (ver `docs/04`, sección "Componente compartido: select personalizado"), agregado 2026-09-15. No es de un rol en particular, prueba el componente en sí:

1. El `<select>` real queda invisible (`opacity:0`) pero con un bounding box real (no colapsado a tamaño 0) — se verifica el estilo computado en vez de `toBeHidden()`, porque a propósito Playwright tiene que poder seguir usando `selectOption()` sobre él (así no hubo que tocar ningún test existente que ya lo hacía). El botón que lo reemplaza queda visible en su lugar.
2. Abrirlo muestra un panel propio (no el popup nativo del navegador) con todas las opciones.
3. La opción resaltada al pasar el mouse usa el rosa de la marca (`--color-rosa-pale`, se verifica el color RGB computado), no el azul del sistema operativo.
4. Elegir una opción actualiza el botón, el `<select>` real (`toHaveValue()`), y dispara el comportamiento real de la pantalla (se prueba filtrando campañas por una provincia sin resultados y confirmando que aparece el cartel de "sin resultados" — no alcanza con que se vea bien, tiene que filtrar de verdad).
5. Escape y click afuera cierran el panel sin cambiar nada.
6. Un select bloqueado (`disabled`, ej. "¿Donaste antes?" ya completado — escritura única) no abre el panel al clickearlo.
7. Una asignación programática de `.value` (ej. `cargarPerfil()` precargando el formulario) sincroniza el botón sin que haga falta ningún click — confirma que el interceptor de `Object.defineProperty` funciona, no solo el flujo manual de abrir/elegir.
8. **No genera scroll horizontal en la página** — regresión real encontrada por la usuaria (el `<select>` oculto resolvía su `width:100%` contra todo el viewport al no tener ningún ancestro `position:relative`, en vez de contra su contenedor original; corregido forzándolo a 1×1px, ver `docs/04`).
9. `publico/pago.html` y `publico/contacto.html` (mockups estáticos que no cargaban ningún script de HemoRed) también tienen el componente, agregado a pedido explícito de la usuaria.
10. **El panel tampoco genera scroll horizontal interno** con opciones largas (ej. "Santiago del Estero") — segundo bug de scroll, encontrado después de corregir el primero: el panel se achicaba al ancho exacto de un botón angosto como "Provincia", y `overflow-y:auto` traía `overflow-x:auto` de regalo (regla del spec de CSS). Arreglo final: se ensanchó el CAMPO en sí (`.filter-select`, `min-width:200px` en `donante.css`/`hospital.css`/`admin.css`), no el panel — así el texto entra en una sola línea sin partirse y panel/botón quedan siempre del mismo ancho. Se puede scrollear dentro del panel para ver las opciones de más abajo sin que se cierre solo (tercer bug, encontrado al verificar el segundo: el listener de "cerrar al scrollear la página" no distinguía el scroll interno del panel).

**`dashboard-modal-turno.spec.js`** — el modal "Detalle del turno" de `donante/dashboard.html` (botón "Ver detalles" del banner de próximo turno), agregado 2026-09-16. Hasta esa fecha era 100% HTML fijo (siempre "Hospital Ramos Mejía", "20 may", "Campaña urgente 0−", etc., sin relación con el turno real — coincidía por casualidad con la cuenta demo) y sus 3 botones no pasaban ningún id por la URL, la usuaria notó que "Modificar turno" obligaba a volver a buscar el turno en la lista de `mis_turnos.html` en vez de abrir directo el modal de modificación:

1. El modal muestra los datos reales del turno confirmado más próximo (hospital, fecha/hora, estado, campaña, tipo de sangre, número `#TRN-<id>`, y el checklist real de formularios completados/pendientes) — no el mockup fijo de antes.
2. "Modificar turno" navega a `mis_turnos.html?turno_id=<id>` y esa pantalla abre el modal de modificación directo, con los datos del turno correcto (antes solo mandaba a la lista, sin id).
3. "Ver campaña" navega a `campana_detalle.html?id=<id>` con la campaña real del turno (antes tampoco pasaba ningún id).
4. "Completar cuestionario" pasa el `turno_id` real y queda oculto si el donante ya completó los 2 formularios pre-donación.

**`cupo-confirmacion-automatica.spec.js`** — confirmación automática y cupo por turno (`crearTurno()`/`actualizarTurno()`), agregado 2026-09-18 a pedido de la usuaria ("que sea automático en ambas instancias, ya que el hospital setea la capacidad al crear la campaña"). Antes, reservar SIEMPRE nacía `pendiente` (RF3, el hospital confirma a mano) y un horario se bloqueaba con el primer turno, sin importar cuántos donantes admitiera en simultáneo:

1. Una campaña con `confirmacion_automatica: true` (id 2, "Banco de sangre general") confirma el turno al instante, sin pasar por `pendiente`.
2. Una campaña sin esa configuración (id 1, urgente con paciente específico) sigue naciendo `pendiente` como antes — no se rompió nada para el caso que ya probaba `golden-path.spec.js`.
3. El `cupo_por_turno` de la campaña (2, para la id 2) admite más de un donante en el mismo hospital+fecha+hora — se prueba con 3 donantes distintos: el 1º y 2º entran, el 3º se rechaza con "Ese horario ya no está disponible". Se llama directo a `HemoRed.data.crearTurno()` (no por la UI), mismo criterio que `restricciones-elegibilidad.spec.js`, porque lo que se prueba es la regla de negocio en sí.

Ver `docs/04-estado-actual-prototipo.md`, sección "Confirmación automática y cupo por turno", para el detalle completo (valores semilla por campaña, y que el flujo de "Nueva campaña" del hospital para setear esto desde la UI todavía no está conectado).

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
