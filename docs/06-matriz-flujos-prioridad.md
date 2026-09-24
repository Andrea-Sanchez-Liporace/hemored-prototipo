# Matriz: flujos del sistema, estado y prioridad

**Fecha:** 2026-09-23 · **Última actualización:** 2026-09-24 (se agrega el detalle de Donante, antes resumido en un párrafo, para tener el progreso de los 5 bloques — Público/Donante/Hospital/Super Admin/Profesional — en el mismo formato)

**Por qué existe esto:** `docs/04-estado-actual-prototipo.md` ya tiene, flujo por flujo, si está conectado (🟢/🟡/🔴) y qué le falta técnicamente. Esta matriz toma esas mismas filas y les agrega la capa de planificación que todavía faltaba: **nivel de diseño** (independiente del nivel de desarrollo — un flujo puede estar 🔴 sin conectar y tener el diseño visual terminado, o viceversa), **esfuerzo estimado**, **prioridad** y **si conviene encararlo completo de una vez o de a partes**. Es la base para decidir qué se toca primero ahora que arranca la revisión de Hospital/Admin (hito 4 del correo al profesor).

## Cómo leer las columnas

- **Desarrollo:** mismo criterio 🟢/🟡/🔴 que `docs/04` (🟢 conectado a datos reales, 🟡 diseñado pero no conectado o "lectura silenciosa", 🔴 el botón no hace nada real).
- **Diseño:** 🟢 Completo (la UI está terminada, con datos reales o de ejemplo, responsive) — 🟡 Parcial (existe pero le falta algo: un estado vacío, un caso de error, ajustes de responsive) — ⚪ Sin revisar (todavía no pasó por una revisión de diseño intencional, más allá de que la pantalla exista). Es una estimación honesta a partir de mirar el HTML/CSS de cada pantalla, no un dictamen — la revisión formal de diseño de Hospital/Admin (hito 4) puede corregir estos valores.
- **Esfuerzo:** para ESTE prototipo (sin backend real, ver `docs/05` — es escribir la función de negocio + `db.crear()`/`db.actualizar()` + cablear el HTML), no para la versión con backend real. Bajo = una función chica o solo agregar `id`s a un HTML que ya tiene la lectura hecha. Medio = una función de negocio con algo de validación, un modal. Alto = varias tablas nuevas relacionadas, un wizard de varios pasos, o un módulo completo sin ninguna base.
- **Prioridad:** MoSCoW de `docs/03` (Must/Should/Could/Won't del alcance v1) + la "Hoja de ruta sugerida" ya existente en `docs/04` (Paso 0 a 6).
- **Enfoque:** **Completo** = el flujo tiene sentido cerrarlo de punta a punta en una sola pasada (no depende de otro rol, o depender de él no cambia el orden). **Por partes** = conviene dividirlo — ya sea porque cruza varios roles en cadena (no sirve de nada la mitad) y hay que ordenar esa cadena, o porque agrupa varias pantallas con el mismo patrón de arreglo y conviene resolverlas juntas como un lote (ej. los 3 dashboards "silenciosos").

---

## Público / Onboarding

| Flujo | Rol | Desarrollo | Diseño | Qué falta | Esfuerzo | Prioridad | Enfoque |
|---|---|---|---|---|---|---|---|
| Landing pública | Público | 🟢 | 🟢 | — | — | — | — |
| Login | Público | 🟢 | 🟢 | Ya autentica contra `usuarios.json` además de las 4 cuentas demo (corregido, ver `docs/04`); falta el caso "hospital pendiente → redirigir a cuenta pendiente", bloqueado hasta que exista un hospital `pendiente` real (ver fila de abajo). | — | — | — |
| Registro de donante | Público→Donante | 🟢 | 🟢 | — | — | — | — |
| Registro de hospital | Público→Hospital | 🔴 | 🟢 | No lee ni guarda ningún campo del formulario. | Medio | Must | **Por partes** — es el primer eslabón de la cadena Registro→Pago→Aprobación (ver más abajo), no sirve resolverlo solo. |
| Pago de plan hospital | Público→Hospital | 🔴 | 🟢 | No crea factura ni hospital, y redirige directo al dashboard sin pasar por aprobación (contradice el propio texto de la pantalla anterior). | Medio | Must | **Por partes** — mismo motivo. |
| Cuenta pendiente de aprobación | Público | 🟡 | 🟡 | Pantalla huérfana — ningún flujo navega hacia acá todavía. Datos 100% hardcodeados. | Bajo | Must | **Por partes** — es el destino final de la cadena de arriba. |
| Recuperar contraseña | Público | 🟢 | 🟢 | Cerrado 2026-09-24. El paso "Revisá tu email" sigue siendo solo de interfaz a propósito (no hay backend que mande un código real). | — | — | — |
| Contacto / lead institucional | Público | 🟢 | 🟢 | Cerrado 2026-09-24 — el lead ya se guarda de verdad (`mensajes_contacto`). Sigue faltando la vista de admin que los liste. | — | — | — |
| Nosotros / Términos / Privacidad | Público | 🟢 | 🟢 | Contenido estático, no requiere lógica. | — | — | — |
| Modal de bienvenida (aviso institucional) | Público | 🟢 | 🟢 | Se muestra una vez por navegador, explica que es un prototipo académico y su alcance real. | — | — | — |

**Nota:** Registro de hospital → Pago → Cuenta pendiente → Aprobación por Super Admin es **una sola cadena de 4 pantallas en 2 roles** (Público/Hospital + Super Admin) que hoy existen cada una por separado sin tocarse entre sí — la propia documentación interna del sistema (`admin/documentacion.html`) ya describe el flujo correcto. Es el ejemplo más claro de "cableado faltante" del prototipo: no falta diseñar nada, falta conectar 4 piezas ya construidas.

**Actualización 2026-09-23/24:** este bloque pasó por una revisión completa de responsive (mobile 320-375px) y una migración de todos sus estilos inline a `publico.css` (no cambia ningún estado 🟢/🔴, son ajustes de calidad de código y de UI) — ver `docs/04`, sección "Público / Onboarding", para el detalle. De paso se encontraron y corrigieron 2 filas de esta misma tabla que estaban desactualizadas (Login y Registro de donante ya estaban conectados de verdad, no 🔴/parcial como decía la versión anterior), y se cerraron 2 flujos reales más: **Recuperar contraseña** y **Contacto/lead institucional**. De los 8 flujos originales de este bloque, quedan sin conectar solo los 3 que forman la cadena Registro de hospital → Pago → Cuenta pendiente (ver nota de arriba) — todo lo demás de Público ya está 🟢.

---

## Donante — ya cerrado

| Flujo | Vistas | Desarrollo | Diseño | Qué falta | Esfuerzo | Prioridad | Enfoque |
|---|---|---|---|---|---|---|---|
| Explorar campañas | `dashboard.html` | 🟢 | 🟢 | — | — | — | — |
| Reservar turno | `campana_detalle.html` | 🟢 | 🟢 | — | — | — | — |
| Completar formularios pre-donación (F1/F2) | `formularios_predonacion.html` | 🟢 | 🟢 | — | — | — | — |
| Mis turnos — ver (próximos/historial/cancelados) | `mis_turnos.html` | 🟢 | 🟢 | — | — | — | — |
| Mis turnos — cancelar / reprogramar | `mis_turnos.html` (modal) | 🟢 | 🟢 | — | — | — | — |
| Mis documentos | `mis_documentos.html` | 🟢 | 🟢 | — | — | — | — |
| Mis donaciones | `mis_donaciones.html` | 🟢 | 🟢 | — | — | — | — |
| Formulario post-donación anónimo (F4) | `postdonacion_anonimo.html` | 🟢 | 🟢 | — | — | — | — |
| Notificaciones | `notificaciones.html` | 🟢 | 🟢 | — | — | — | — |
| Editar perfil (incl. Seguridad de la cuenta) | `perfil.html` | 🟢 | 🟢 | — | — | — | — |

Las 10 filas están 🟢 desarrollo y 🟢 diseño (incluido el pase completo de responsive mobile y la migración de estilos inline a CSS de esta sesión) — no compiten por prioridad porque ya están hechas, se listan acá completas (a diferencia de la versión anterior de esta matriz, que las resumía en un párrafo) para que el progreso de los 5 bloques del sistema quede registrado con el mismo nivel de detalle. Ver `docs/04`, sección "Donante", para el historial técnico completo de cada fila.

---

## Hospital

### Campañas, turnos y documentación clínica

| Flujo | Desarrollo | Diseño | Qué falta | Esfuerzo | Prioridad | Enfoque |
|---|---|---|---|---|---|---|
| Ver dashboard | 🟡 | 🟢 | "Lectura silenciosa": la función ya trae los datos reales, el HTML no tiene los `id` para mostrarlos. | Bajo | Must (paso 1 de la hoja de ruta) | **Por partes** — agrupar con los otros 2 dashboards silenciosos (Admin, Profesional), es el mismo arreglo 3 veces. |
| Crear campaña — paso 1 | 🔴 | 🟢 | El botón "Siguiente" ni navega (`alert()`). | Bajo | Must | **Por partes** — los 3 pasos del wizard son una sola unidad, no tiene sentido cerrar uno sin los otros dos (nada se guarda hasta el paso 3). |
| Crear campaña — paso 2 | 🔴 | 🟢 | Sin ningún traspaso de datos entre pasos (cero `sessionStorage`). | Medio | Must | **Por partes** — ídem. |
| Crear campaña — paso 3 (publicar) | 🔴 | 🟢 | "Publicar" no crea ningún registro real. | Medio | Must | **Por partes** — acá se cierra el wizard completo; recomendado encarar los 3 pasos juntos en una sola tarea. |
| Ver/gestionar campañas | 🔴 | 🟡 | Filas fijas (8, la BD real tiene 4); ningún botón de acción tiene `onclick`. | Medio | Must | Completo — pero lógicamente depende de que "Crear campaña" ya exista (si no, no hay campañas propias que gestionar más allá de las semilla). |
| Ver detalle de campaña (hospital) | 🔴 | 🟡 | 100% estático, no lee `id` de la URL; sin acciones de confirmar/rechazar turno. | Medio | Must | Junto con "Ver/gestionar campañas". |
| Gestionar turnos del día | 🟢 | 🟢 | — | — | — | — |
| Registrar donación | 🟢 | 🟢 | — | — | — | — |
| Cargar resultado de análisis | 🔴 | 🟢 | "Cargar resultado" = "Cancelar" (no persiste). | Medio | Should | Completo — pero recordar el insert dual a `documentos` (si no, el donante nunca lo ve del lado suyo, que ya está conectado). |
| Emitir certificado de donación | 🔴 | 🟢 | Mismo patrón que arriba. | Medio | Should | Completo, mismo motivo del insert dual. |
| Revisar solicitudes de corrección | 🟢 | 🟢 | — | — | — | — |

### Pacientes, profesionales, facturación y métricas

| Flujo | Desarrollo | Diseño | Qué falta | Esfuerzo | Prioridad | Enfoque |
|---|---|---|---|---|---|---|
| Registrar/listar pacientes | 🔴 | 🟡 | Lista fija no coincide con `pacientes.json`; "Guardar" sin `onclick`. | Bajo | Should | Completo |
| Ver/editar detalle de paciente | 🔴 | 🟡 | No lee `id` de la URL. | Bajo | Should | Junto con la fila de arriba. |
| Registrar/gestionar profesionales | 🔴 | 🟡 | Tarjetas fijas; **no muestra el estado de firma digital**, que es un gate de negocio explícito antes de asignar turnos. | Medio | Podría esperar (bloquea Profesional v2, no el MVP) | Completo |
| Ver/desvincular profesional | 🔴 | 🟡 | Hardcodeado a un profesional fijo; "Dar de baja" sin `onclick`, ni simulado. | Bajo | Podría esperar | Junto con la fila de arriba. |
| Consultar métricas del hospital | 🟡 | 🟢 | Gráficos y KPIs son arrays fijos; selector de período es un stub vacío. | Medio | Should | Completo |
| Ver/pagar facturas | 🔴 | 🟢 | Filas fijas no coinciden con `facturas.json`; "Pagar ahora" sin `onclick`. | Bajo | Should | **Por partes** — depende de que exista alguna factura real (Admin la emite), ver "Facturación global" más abajo. |
| Solicitar cambio de plan | 🔴 | 🟡 | Solo navega a pago, no valida ni cambia nada. | Medio | Could | Completo |
| Ver/enviar mensajes con HemoRed | 🔴 | ⚪ | **La pantalla no existe** — hay datos semilla reales (`mensajes.json`) que nadie muestra. | Alto (vista nueva + lógica) | Should | Completo, pero requiere pasar primero por una revisión de diseño (no hay nada que mirar hoy). |
| Editar perfil del hospital | 🔴 | 🟡 | Todo hardcodeado, ningún "Guardar" tiene `onclick`; subir habilitación sanitaria no persiste. | Bajo | Should | Completo |

**Hallazgo de este bloque:** el diseño visual de Hospital está bastante más avanzado que su desarrollo — casi todas las pantallas 🔴 tienen diseño 🟢/🟡, no ⚪. El trabajo pendiente de Hospital es mayoritariamente **cableado**, no diseño desde cero (excepción: mensajería, que no existe como pantalla).

---

## Super Admin

| Flujo | Desarrollo | Diseño | Qué falta | Esfuerzo | Prioridad | Enfoque |
|---|---|---|---|---|---|---|
| Dashboard global | 🟡 | 🟢 | Lectura silenciosa + gráficos con arrays fijos. | Bajo (el bind) / Medio (los gráficos) | Must (paso 1) | **Por partes** — agrupar con los otros 2 dashboards silenciosos. |
| Aprobar / rechazar hospital | 🔴 | 🟢 | "Aprobar" no cambia nada; el hospital semilla `pendiente` no tiene forma de pasar a `activo`. | Medio | Must | **Por partes** — es el cierre de la cadena Registro→Pago→Aprobación de Público/Hospital, hay que resolverla junto con esa cadena, no antes ni de forma aislada. |
| Listado y filtro de hospitales | 🟢 (parcial) | 🟢 | El filtro funciona de verdad, pero sobre 7 filas fijas que no son los 5 hospitales reales. | Bajo | Must | Completo |
| Detalle de hospital | 🔴 | 🟡 | No lee `id`; ninguna acción (marcar pagada, mensaje, suspender) tiene efecto. | Medio | Should | Completo, aunque "suspender" depende de que existan campañas/turnos reales de ese hospital para probar la cascada. |
| Gestión de donantes | 🔴 | 🟡 | Filas fijas; suspender/reactivar no toca `usuarios.json`. | Medio | Should | Completo |
| Métricas globales | 🔴 | 🟢 | ~12 gráficos 100% mock, cero llamadas a `db.js`. | Alto | Podría esperar | Completo, pero es la pantalla más cara de este rol — considerar dejarla para el final del bloque Admin. |
| Gestión de planes | 🔴 | 🟢 | UI de alta/edición completa con preview en vivo, pero "Guardar" no lee los inputs. | Bajo | Should | Completo |
| Facturación global | 🔴 | 🟡 | Filas fijas (6, no coinciden con `facturas.json`). | Medio | Should | **Por partes** — conviene resolverla junto con "Emitir factura" (abajo) y con "Ver/pagar facturas" de Hospital, son las 3 caras del mismo objeto. |
| Emitir nueva factura | 🔴 | 🟢 | El cálculo de IVA/total en vivo funciona; "Emitir y enviar" no crea nada (número hardcodeado). | Bajo | Should | Junto con "Facturación global". |
| Documentación del sistema | 🟢 | 🟢 | — | — | — | — |

**Hallazgo de este bloque (ya estaba en `docs/04`):** ninguna de las 8 pantallas operativas de Super Admin escribe una sola vez en ningún lado — es el rol con el gap de desarrollo más completo de todo el prototipo, a pesar de tener, en general, el diseño visual más pulido (varias en 🟢).

---

## Profesional de salud (v2)

| Flujo | Desarrollo | Diseño | Qué falta | Esfuerzo | Prioridad | Enfoque |
|---|---|---|---|---|---|---|
| Turnos del día (dashboard) | 🟡 | 🟢 | Lectura silenciosa — la cadena `usuario→profesional→hospital→turnos` ya se resuelve bien en JS, falta el `id` en el HTML. | Bajo | Won't (v2) — pero si se toca algo de Profesional antes de tiempo, es esto, es igual de barato que los otros 2 dashboards silenciosos. | **Por partes**, agrupado con los otros dashboards. |
| Atención clínica (F1→F4 + QR) | 🟡 | 🟢 | **Es la pantalla más desarrollada de todo el prototipo** (checklist, cuestionario de 42 preguntas, firma, signos vitales, decisión apto/no apto, QR) pero no persiste nada — cerrar el modal borra todo. | Alto | Won't (v2) | Completo — es grande pero autocontenido (4-5 funciones nuevas, 2 tablas), no tiene sentido partirlo por rol porque es un solo rol. Dejar para cuando se aborde v2 como bloque separado. |
| Perfil y firma digital | 🔴 | 🟢 | El canvas de firma funciona y valida, pero nunca se guarda (`// Aquí se enviaría al servidor`). | Bajo | Won't (v2) | Completo |

**Por qué v2 y no antes:** es contenido explícitamente fuera del alcance MVP (`docs/03`, MoSCoW "Won't Have"), aunque la UI ya esté construida con mucho detalle — el criterio de priorización acá no es "cuánto falta" sino "está en el alcance de esta entrega".

---

## Resumen ejecutivo: orden sugerido de ataque

Mismo orden que la "Hoja de ruta sugerida" de `docs/04`, con la razón resumida acá:

1. **Los 3 dashboards "silenciosos"** (Hospital, Admin, Profesional) — esfuerzo bajo, la lectura ya funciona, solo falta HTML. El quick win más barato de todo el prototipo.
2. **Núcleo Hospital (MVP):** crear campaña (3 pasos como bloque), ver/gestionar campañas, ver detalle de campaña. Sin esto, el "camino feliz" completo (donante busca → reserva → hospital gestiona) no se puede mostrar de punta a punta con datos que no sean 100% semilla.
3. **Cadena Registro de hospital → Pago → Cuenta pendiente → Aprobación (Admin):** hoy las 4 piezas existen sueltas; conectarlas es más "cablear" que "construir".
4. **Should Have:** historial/documentación clínica de Hospital (resultado + certificado, con el insert dual a `documentos`), facturación (las 3 pantallas — Hospital paga, Admin emite/marca pagada — como un bloque), mensajería Hospital↔HemoRed (necesita pasar por diseño primero, no existe la vista).
5. **Podría esperar:** métricas con agregación real (hoy ya "funcionan" visualmente para una demo con datos de relleno), gestión de pacientes/profesionales de Hospital.
6. **v2, al final y como bloque separado:** módulo de atención clínica del Profesional — grande pero autocontenido, y la UI ya está prácticamente lista.
