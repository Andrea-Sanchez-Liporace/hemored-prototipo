# Hemored — Plataforma de gestión de campañas de donación de sangre

## Documentación técnica consolidada

**Integrantes:** Sofía Páez, Natalia Sanchez Liporace, Andrea Sanchez Liporace
**Materia:** Prácticas profesionalizantes III
**Fecha de presentación:** 01/06/2026

> Fuente original: `PP3 - Grupo 3 - Hemored - Pte 5.pdf`

---

## Introducción

### Contexto del problema

En Argentina, solo el 1,7% de la población dona sangre regularmente, cuando la OMS recomienda un mínimo del 1% como reserva estratégica. Durante picos de demanda (accidentes, cirugías, enfermedades oncológicas), los hospitales recurren a convocatorias informales por redes sociales y WhatsApp que no garantizan una respuesta organizada ni oportuna.

Consecuencias concretas:
- Demoras en la cobertura de campañas urgentes que pueden costar vidas.
- Falta de trazabilidad: no hay registro centralizado de quién donó, cuándo y para quién.
- Dificultad para medir la efectividad de cada convocatoria y tomar decisiones basadas en datos.

### La solución: Hemored

**Técnico:** HemoRed implementa una arquitectura cliente-servidor con API REST, autenticación basada en roles y persistencia en base de datos relacional, conectando hospitales con donantes y centralizando publicación de campañas, reserva de turnos, registro de donaciones y análisis de métricas de efectividad.

**Lenguaje natural:** Plataforma web usable desde cualquier navegador, sin instalar nada. Los hospitales publican campañas, los donantes las buscan y reservan turno de forma ordenada, con registro de cada paso. Cada tipo de usuario (donante, hospital, administrador, profesional de salud) ve solo lo que le corresponde. El donante contará además con una app móvil descargable (única instalación opcional).

### Alcance del MVP

Este análisis documenta el **MVP (v1)** con las funcionalidades core. El modelo de datos y la arquitectura fueron diseñados contemplando el sistema completo desde el inicio (**principio de escalabilidad estructural**): las tablas y módulos de v2 están definidos en el esquema pero no activados, evitando migraciones destructivas a futuro.

---

## Necesidades y requisitos

### Identificación de necesidades

- Los donantes requieren búsqueda y filtrado de campañas activas por compatibilidad sanguínea y geolocalización, interfaz responsive.
- Los donantes requieren reserva de turnos con disponibilidad en tiempo real y confirmación automática.
- Los hospitales requieren gestión de campañas con control de estados (borrador, activa, pausada, cerrada) y alcance geográfico según plan contratado.
- Los hospitales requieren dashboard de turnos del día con actualización en tiempo real y filtros por estado.
- Los hospitales y el super admin requieren dashboards de métricas con agregación por campaña, período y rol.
- Los hospitales requieren facturación integrada con planes de suscripción, historial de pagos y cambios de plan auditables.
- *(v2)* Los hospitales requerirán gestión de profesionales de salud con flujo de atención clínica, formularios médicos digitales y firma digital.

### Requisitos funcionales

**Versión 1 — MVP**

| # | Requisito |
|---|---|
| RF1 | Permitir a los donantes visualizar campañas activas compatibles con su tipo de sangre y reservar turnos de donación. |
| RF2 | Permitir a los hospitales crear, publicar y gestionar campañas de donación de sangre. |
| RF3 | Permitir a los hospitales gestionar los turnos de donación solicitados por cada campaña vigente. |
| RF4 | Permitir a donantes y hospitales consultar el historial de donaciones realizadas. |
| RF5 | Permitir visualizar métricas de efectividad por campaña y métricas globales del sistema. |
| RF6 | Permitir a los hospitales registrar el resultado del análisis de cada donación (carga manual en MVP). |
| RF7 | Gestionar la facturación y planes de suscripción de los hospitales. |

**Versión 2 — Módulo de atención clínica**

| # | Requisito |
|---|---|
| RF8 | Los profesionales de salud podrán registrar la evaluación clínica del donante y determinar su aptitud para donar. |
| RF9 | Gestionar formularios médicos digitales previos y posteriores a la donación, incluyendo firma digital del donante y del profesional. |
| RF10 | Notificar automáticamente al donante el resultado de su análisis una vez esté disponible. |

### Requisitos no funcionales

- **Rendimiento:** respuesta en menos de 2 segundos para el 95% de las solicitudes bajo carga normal.
- **Disponibilidad:** 99% mensual, excluyendo mantenimientos programados.
- **Seguridad:** autenticación con contraseña encriptada, control de acceso basado en roles, protección de datos clínicos sensibles.
- **Escalabilidad:** al menos 1.000 usuarios concurrentes sin degradación significativa.
- **Usabilidad:** accesible desde cualquier navegador moderno sin instalación.

### User stories

**v1:**
- Como donante quiero buscar campañas para colaborar de forma rápida y efectiva.
- Como donante quiero reservar un turno de donación desde la plataforma para organizar mi tiempo y llegar preparado.
- Como administrativo del hospital quiero crear y publicar campañas de donación para convocar donantes de forma organizada.
- Como administrativo del hospital quiero medir la efectividad de cada campaña para tomar decisiones basadas en datos.
- Como administrativo del hospital quiero gestionar la facturación y mi plan para administrar los costos del servicio de forma autónoma.
- Como súper admin del sistema quiero aprobar o rechazar el registro de hospitales para garantizar que solo instituciones habilitadas operen en la plataforma.
- Como súper admin del sistema quiero visualizar métricas globales del sistema para monitorear el crecimiento y la salud operativa de HemoRed.

**v2:**
- Como profesional de salud quiero registrar la evaluación clínica del donante para determinar su aptitud de forma trazable y auditable.
- Como profesional de salud quiero registrar la extracción de sangre del donante para dejar registrado el ingreso de la donación y generar el formulario de exclusión post-donación.
- Como donante quiero completar mis formularios médicos previos al turno desde la plataforma para llegar preparado y agilizar mi atención el día de la donación.

### Priorización MoSCoW

**Must Have:** registro de usuarios (RF1), reserva de turnos (RF1), creación de campañas (RF2), gestión de solicitudes de sangre (RF2), gestión de turnos (RF3). *Sin esto el sistema no tiene razón de existir.*

**Should Have:** historial de donaciones (RF4), métricas por campaña (RF5), registro de resultados de análisis (RF6), facturación y planes de suscripción, mensajería interna HemoRed-hospitales. *Agregan valor real, no bloquean el lanzamiento del MVP.*

**Could Have:** dashboard personalizado (RF5 ext.), notificación del resultado clínico al donante (RF7), notificaciones automáticas (RF7 ext.). *Mejoras deseables, su ausencia no impide usar el sistema.*

**Won't Have (alcance actual):** integración con sistemas hospitalarios externos (HIS/INCUCAI), app mobile nativa (App Store/Google Play), módulo de atención clínica completo (v2), notificación automática del resultado clínico (v2).

---

## Arquitectura

**Técnico:** HemoRed implementa una arquitectura cliente-servidor monolítica modular con dos clientes que consumen una API REST centralizada: una SPA en **React** que soporta los 4 roles del sistema, y una app mobile orientada al donante (v2). El backend en **Python/Django** sigue el patrón MVC con arquitectura en capas (presentación, aplicación, negocio, persistencia); cada módulo funcional encapsula su lógica de dominio y expone su funcionalidad solo vía API REST. Se descartó microservicios por costo adicional innecesario en esta etapa; la estructura modular del monolito permite migración incremental si el volumen o la complejidad lo justifican a futuro.

### Diagrama de la arquitectura

```
CAPA DE PRESENTACIÓN — Clientes
  ├─ Aplicación Web (React)
  ├─ App Mobile — v2 (donante)
  └─ Otros clientes — v2
          │  HTTPS / JSON
          ▼
CAPA DE APLICACIÓN — API REST
  Django REST Framework · Autenticación JWT · Endpoints /api/{recurso}
          ▼
CAPA DE NEGOCIO — Lógica del sistema
  Reglas de compatibilidad sanguínea · Estados de campañas · Gestión de roles · Facturación
          ▼
CAPA DE DATOS — Persistencia          SERVICIOS EXTERNOS
  PostgreSQL · ORM Django (20 tablas)   SendGrid
  S3 Files                              MercadoPago
```
*(v2 = funcionalidades previstas para la versión 2 del sistema)*

---

## Matriz comparativa y solución seleccionada

*(Ver detalle completo en [`02-matriz-comparativa-alternativas.md`](./02-matriz-comparativa-alternativas.md))*

Se compararon tres alternativas con 6 criterios ponderados: **Desarrollo propio (4.5/5 — 93%)**, Solución híbrida con Firebase/BaaS (2.8/5 — 56%), Bot conversacional en WhatsApp (2.67/5 — 52%).

**Alternativa elegida: Desarrollo propio.** Justificación resumida:
- **Adaptabilidad al dominio (20%):** lógica de negocio específica (estados de campañas, compatibilidad sanguínea, roles, documentación clínica) no puede replicarse con reglas declarativas de un BaaS ni con la interfaz limitada de un bot.
- **Seguridad y privacidad (20%):** control total sobre autenticación, cifrado y almacenamiento propio. Firebase implicaría datos clínicos bajo jurisdicción de Google — riesgo de compliance inaceptable para un sistema de salud.
- **Mantenibilidad (15%):** propiedad del código fuente, sin dependencia contractual de terceros.

Se descarta Firebase por fragmentación de la lógica de negocio y almacenamiento de datos clínicos en servidores de terceros. Se descarta el bot conversacional por no constituir un sistema de gestión (sin dashboards, sin roles, sin documentación clínica) y por el riesgo operativo de depender de las políticas de WhatsApp Business/Meta.

---

## Diagrama BBDD

**Técnico:** la base de datos se compone de **20 tablas organizadas en cinco grupos**. Las 6 entidades principales modelan los objetos centrales del dominio (usuarios, hospitales, pacientes, profesionales, campañas, donaciones), unificando todos los roles en una sola tabla mediante el campo discriminador `rol`. Las 3 tablas intermedias resuelven relaciones N:M con contexto temporal. Las 5 tablas del sistema de documentos implementan el patrón **Table Inheritance** (una tabla central que concentra las relaciones + 3 tablas hijas preparadas para incorporar campos estructurados en v2 sin migraciones destructivas). Las 5 tablas de facturación gestionan el modelo SaaS con auditoría de cambios de plan. Las 2 tablas del módulo de atención clínica están incluidas en el esquema desde el diseño inicial pero sin poblar hasta que el módulo se active en v2.

> Para el detalle campo a campo de cada tabla y las relaciones entre entidades, ver [`01-relevamiento-requisitos.md`](./01-relevamiento-requisitos.md#diseño-de-base-de-datos-y-modelo-de-datos). El modelo de datos coincide con las 20 tablas ya presentes como fixtures en [`/frontend/db`](../frontend/db) (`usuarios.json`, `hospitales.json`, `campanas.json`, `turnos.json`, `donaciones.json`, `documentos.json`, `formulario_consentimiento.json`, `formulario_postdonacion.json`, `certificado_donacion.json`, `resultado_analisis.json`, `tipo_documento.json`, `pacientes.json`, `paciente_hospital.json`, `profesionales.json`, `profesional_hospital.json`, `planes.json`, `facturas.json`, `medios_pago.json`, `mensajes.json`, `hospital_plan_historial.json`).

---

## Manual de uso

HemoRed es una plataforma web de acceso libre desde cualquier navegador, sin instalación. Desde el login, el usuario es redirigido automáticamente a su panel correspondiente según su rol.

### Rol: Donante

**Registro y acceso**
- *Usuario:* te registrás con nombre, email, contraseña, fecha de nacimiento y peso (el peso se usa para verificar el requisito mínimo de donación). Con la cuenta creada, entrás con email y contraseña.
- *Técnico:* crea un registro en `usuarios` con `rol: donante`, contraseña con hash bcrypt, token JWT al autenticarse. Redirige al dashboard con campañas activas expuestas vía API REST con control de acceso por rol.

**Login**
- *Usuario:* ingresás con email y contraseña.
- *Técnico:* autenticación JWT, redirección al dashboard de campañas activas.

**Explorar campañas**
- *Usuario:* ves las campañas activas que necesitan tu ayuda; filtrás por urgencia, hospital o búsqueda por paciente. El detalle muestra hospital, paciente, y turnos disponibles.
- *Técnico:* consume `GET /api/campanas`, devuelve campañas activas ordenadas por urgencia con datos de hospital, paciente, unidades requeridas y turnos disponibles.

**Reservar turno**
- *Usuario:* elegís turno (fecha/hora) desde el detalle de la campaña y confirmás. Si donaste hace menos de 90 días, el sistema te avisa cuándo podés volver a donar. El turno confirmado aparece en "Mis turnos" con recordatorio el día anterior.
- *Técnico:* valida disponibilidad en tiempo real contra `turnos`, crea registro `estado: confirmado` asociado a `usuario_id` y `campana_id`. Verifica período de espera activo (< 90 días desde última donación) antes de habilitar la reserva; si aplica, informa la fecha habilitada (solo posible si la extracción previa se registró en este sistema, al no estar integrado con sistemas externos).

**Completar formularios pre-donación**
- *Usuario:* 2 horas antes del turno recibís notificación para completar dos formularios médicos: F1 (documento informativo de exclusión, con firma digital) y F2 (cuestionario médico de historial de salud reciente, con firma digital). Podés consultarlos con el profesional el día del turno.
- *Técnico:* el sistema habilita F1 y F2 asociados al `turno_id`. F1 = autoexclusión con firma vía Signature Pad. F2 = cuestionario de 42 preguntas con consentimiento informado y firma. Ambos se persisten en `formulario_consentimiento` con registro del responsable (donante o profesional).

**Mis turnos**
- *Usuario:* consultás turnos pasados y futuros con su estado, el estado de tus formularios pre-donación, cancelás hasta 2 horas antes, o cambiás el turno hasta 24 horas antes. Después de ese límite, se muestran los datos de contacto del hospital.
- *Técnico:* consulta `turnos` por `usuario_id` con estados (`confirmado`, `en_curso`, `completado`, `no_apto`, `ausente`, `cancelado`) y estado de formularios vinculados. Cancelación hasta 2h antes, modificación hasta 24h antes.

**Mis documentos**
- *Usuario:* sección con 4 pestañas: Resultados (análisis de laboratorio), Evaluaciones clínicas (valores registrados por el profesional el día de la donación, con rangos de referencia), Certificados (descargables, solicitables), Consentimientos (formularios firmados por donación).
- *Técnico:* consulta `documentos` filtrada por `donante_id`, con acceso a tablas hijas según tipo (`resultado_analisis`, `certificado_donacion`, `formulario_consentimiento`). La evaluación clínica (F3) solo es visible para donaciones completadas.

**Formulario post-donación anónimo**
- *Usuario:* antes de retirarte, el profesional te muestra un QR para escanear: formulario corto y anónimo (el sistema no identifica quién lo completa) sobre si tu sangre puede usarse para transfusión. Si no lo escaneás, recibís un link de respaldo válido 24 horas en tu casilla interna.
- *Técnico:* al finalizar la donación se genera un token único vinculado a `numero_bolsa` (no a `usuario_id`), válido 24 horas. Acceso al formulario F4 sin autenticación. Respuesta persistida en `formulario_postdonacion`, anonimato garantizado por diseño.

**Notificaciones**
- *Usuario:* avisos ordenados por fecha (turno confirmado, formularios disponibles, recordatorio, resultado de análisis disponible, certificado emitido). Marcables como leídas individualmente o todas juntas; el click redirige al recurso relacionado.
- *Técnico:* consulta `mensajes` filtrada por `usuario_id` del donante. Cada evento genera un registro con `leido: false`; el badge refleja el conteo de no leídos. Click actualiza `leido: true` y redirige vía `referencia_id`.

### Rol: Administrador de hospital

**Registro y activación de la cuenta**
- *Usuario:* completás datos institucionales (razón social, CUIT, dirección, habilitación sanitaria), elegís plan y pagás. La cuenta queda `pendiente` hasta la revisión y aprobación de HemoRed; al activarse, recibís un email de bienvenida con credenciales.
- *Técnico:* crea registro en `hospitales` con `estado: pendiente`. Tras el pago del plan, queda en espera de aprobación del super admin; al aprobarse, `estado: activo` y notificación por email institucional.

**Login**
- *Usuario:* ves un panel con resumen del hospital: campañas activas, turnos de hoy, métricas recientes.
- *Técnico:* autenticación con `rol: admin_hospital`; dashboard agrega campañas activas, turnos del día y métricas de efectividad. Operaciones restringidas a los recursos del `hospital_id` vinculado.

**Gestionar pacientes**
- *Usuario:* registrás personas que necesitan sangre (nombre, apellido, DNI); luego podés crear la campaña.
- *Técnico:* gestiona registros en `pacientes` vinculados a `hospital_id` vía tabla intermedia `paciente_hospital`.

**Crear campaña de donación**
- *Usuario:* flujo de 3 pasos — (1) datos: cantidad de donaciones necesarias, urgencia, fecha límite, paciente asociado u opción banco de sangre general; (2) disponibilidad: días/horarios, el sistema genera automáticamente los turnos; (3) revisión y publicación.
- *Técnico:* crea registro en `campanas`. Paso 1: `urgencia`, `fecha_limite`, `paciente_id` opcional, `alcance` según plan. Paso 2: rango de fechas/horarios/capacidad por franja — genera turnos automáticamente. Paso 3: publicación cambia `estado: activa`.

**Gestionar turnos del día**
- *Usuario:* lista completa del día ordenada por horario; indicador (aviso naranja) si el donante no completó los formularios previos, completables en el momento por el profesional.
- *Técnico:* consulta `turnos` filtrados por `hospital_id` y fecha actual, con indicadores de estado de formularios pre-donación.

**Gestionar profesionales** *(v2)*
- *Usuario:* registrás profesionales de salud (nombre, apellido, matrícula, especialidad, email institucional) — reciben credenciales automáticas. Ves si registraron firma digital (requisito para atender) y su historial de atenciones. Podés desvincular a un profesional (su historial se conserva, ya no toma turnos nuevos).
- *Técnico:* crea registro en `profesionales` + entrada en `profesional_hospital` (`fecha_desde`, `activo: true`). Desvinculación actualiza `activo: false` con `fecha_hasta`; historial persiste vía `profesional_id` en `donaciones`. Se valida `firma_digital_url` antes de asignar turnos.

**Emitir documentación — resultados**
- *Usuario:* cargás resultados de laboratorio buscando la donación por número de bolsa; al marcarlos disponibles, el donante recibe notificación automática.
- *Técnico:* carga en `resultado_analisis` vinculada a `numero_bolsa`. Campos estructurados (VIH, Hepatitis B/C, Chagas, Brucelosis, HTLV, Sífilis, hemoglobina, hematocrito) se activan en v2; en v1 se almacena el PDF. Al marcar visible, dispara notificación.

**Emitir certificados de donación**
- *Usuario:* generás el certificado buscando por bolsa o donante; incluye fecha, volumen, hospital, profesional y matrícula. El donante recibe notificación y lo descarga desde "Mis documentos". Podés ver solicitudes pendientes.
- *Técnico:* crea registro en `certificado_donacion` vinculado a `documentos` (FK única), con `profesional_matricula` desnormalizado para validez legal ante futuros cambios. Actualiza `visible: true` en `documentos` y dispara notificación.

**Consultar métricas**
- *Usuario:* donaciones realizadas, % de presentación efectiva, efectividad por campaña, evolución mensual, % de formularios completados antes de llegar.
- *Técnico:* agrega datos de `turnos`, `donaciones`, `campanas` filtrados por `hospital_id` y período. Expone efectividad por campaña, tasa de presentación, % formularios por donante vs. profesional, tasa de completado del formulario post-donación.

**Gestionar facturación y plan**
- *Usuario:* consultás facturas (pagada/pendiente/vencida) y registrás pagos. Solicitás cambio de plan; si es downgrade con más campañas activas de las permitidas, el sistema pide cerrarlas antes de confirmar.
- *Técnico:* consulta `facturas` y `planes` por `hospital_id`. Cambios de plan se registran en `hospital_plan_historial` (actor + motivo). Downgrade con campañas activas por encima del nuevo límite requiere cerrarlas primero.

**Gestionar mensajes**
- *Usuario:* comunicaciones con HemoRed (facturas nuevas, avisos, respuestas, recordatorios de pago); podés enviar mensajes al equipo de HemoRed. Indicador de no leídos en el menú.
- *Técnico:* consulta `mensajes` por `hospital_id` y `remitente`. No leídos vía `leido: false`, reflejados en badge. Envío desde hospital crea registro `remitente: hospital`, visible para el super admin.

### Rol: Super Administrador

**Login**
- *Usuario:* panel con estado global: hospitales activos, donaciones del mes, facturación pendiente, métricas generales.
- *Técnico:* autenticación `rol: superadmin`, dashboard con visibilidad global sin restricción por `hospital_id`.

**Aprobar o rechazar hospitales**
- *Usuario:* al registrarse un hospital, revisás sus datos institucionales (razón social, CUIT, habilitación sanitaria) y aprobás o rechazás. Al aprobar, recibe email de bienvenida. Podés suspender un hospital activo por incumplimiento ingresando el motivo — sus campañas se pausan y los donantes con turnos activos son notificados.
- *Técnico:* actualiza `estado` en `hospitales` (`pendiente → activo` / `activo → suspendido`). Suspensión ejecuta cascada: pausa campañas activas del hospital y cancela turnos futuros, notificando a donantes afectados.

**Gestionar planes**
- *Usuario:* ves planes disponibles (alcance geográfico, hospitales activos en cada uno), actualizás precios (aplican desde la próxima facturación, sin afectar facturas ya emitidas), activás promociones con vigencia.
- *Técnico:* actualiza `precio_mensual` y atributos de promoción (`es_promo`, `precio_promo`, `fecha_inicio_promo`, `fecha_fin_promo`) en `planes`.

**Emitir y gestionar facturas**
- *Usuario:* elegís hospital y período; el sistema calcula el monto según el plan activo. Al confirmar, se genera número correlativo y notificación al hospital. Al registrar el pago (medio + fecha), la factura pasa a "pagada". Facturas vencidas muestran badge rojo con días de atraso.
- *Técnico:* crea registro en `facturas` (`hospital_id`, `plan_id`, `periodo`, `monto` calculado). Valida no duplicar factura para mismo hospital/período. El pago actualiza `estado: pagado` y vincula `medio_pago_id`. El plan vigente por período se determina consultando `hospital_plan_historial`.

**Gestionar donantes**
- *Usuario:* listado global de donantes, búsqueda por nombre/DNI/tipo de sangre/cantidad de donaciones. Podés ver historial y desactivar cuentas (solicitud del donante o incumplimiento) — los turnos futuros se cancelan automáticamente y los hospitales afectados son notificados.
- *Técnico:* consulta `usuarios` filtrada por `rol: donante`, con paginación y filtros. Desactivación actualiza `activo: false` y cancela en cascada `turnos` con `estado: confirmado`. Las secciones sensibles del F2 y el formulario post-donación (F4) **no son accesibles** para el super admin — privacidad protegida por diseño a nivel de permisos de la API.

**Consultar métricas globales**
- *Usuario:* 4 paneles — Donaciones (total por período/tipo de sangre/hospital), Negocio (hospitales activos por plan, tasa de conversión de registros a cuentas aprobadas), Facturación (facturado vs. cobrado, vencidas, proyección), Operacional (% formularios completados antes de llegar, % formulario post-donación completado).
- *Técnico:* agrega `donaciones`, `turnos`, `campanas`, `hospitales`, `facturas` y `formulario_postdonacion` sin restricción de `hospital_id`. Los indicadores operacionales cruzan `autoexclusion_completado_por`/`cuestionario_completado_por` (de `formulario_consentimiento`) con `token_usado`/`completado_en` (de `formulario_postdonacion`).

**Gestionar mensajería**
- *Usuario:* todas las comunicaciones con hospitales (enviados y recibidos); podés escribirle a cualquier hospital. No leídos destacados.
- *Técnico:* consulta `mensajes` sin restricción de `hospital_id`, ordenada por `fecha_envio`. Envío desde super admin crea registro `remitente: admin`.

### Rol: Profesional de salud *(módulo previsto para v2)*

**Login**
- *Usuario:* ves los turnos del día con su estado y el estado de los formularios pre-donación de cada donante.
- *Técnico:* autenticación `rol: profesional`. Vinculado al hospital vía `profesional_hospital` y a cada donación vía `profesional_id` en `donaciones`.

**Gestionar perfil**
- *Usuario:* datos profesionales (nombre, matrícula, especialidad, hospitales vinculados) de solo lectura — corrección vía el administrador del hospital. Historial de atenciones consultable. Único dato editable: firma digital.
- *Técnico:* consulta `profesionales` vía `usuario_id` y entradas activas de `profesional_hospital`. Única escritura habilitada: `firma_digital_url`.

**Registrar firma digital en perfil**
- *Usuario:* dibujás tu firma (dedo/mouse) en "Mi perfil". Se aplica automáticamente en F1/F2 cuando asististe al donante en el llenado. Firmas anteriores quedan archivadas para auditoría.
- *Técnico:* almacena la firma como imagen en S3, registra la URL en `firma_digital_url` de `profesionales` con `firma_registrada_en`. Firma anterior se archiva. Se aplica en `firma_profesional_perfil_url` de `formulario_consentimiento` cuando el profesional indica que asistió en F1/F2.

**Verificar documento de autoexclusión**
- *Usuario:* verificás si el donante completó F1 antes de llegar; confirmás lectura/comprensión (tu firma de perfil se aplica automáticamente si asististe). Si no lo completó, lo hacés en el momento junto a él. Si declara una exclusión, cerrás el turno como no apto y el flujo termina ahí.
- *Técnico:* actualiza `autoexclusion_completado_por` (`donante`/`profesional`) en `formulario_consentimiento`. Exclusión declarada → `estado: no_apto` en `turnos`, cierra el flujo sin avanzar a F2.

**Completar cuestionario médico**
- *Usuario:* revisás F2 (completado previo o en el momento); podés modificar respuestas (queda registrado con fecha/hora). El donante firma el consentimiento informado en pantalla, tu firma de perfil se aplica si asististe.
- *Técnico:* actualiza `cuestionario_completado_por`. Modificación por el profesional marca `cuestionario_modificado_por_profesional: true` con timestamp. Firma del donante en `firma_donante_cuestionario_url`, del profesional en `firma_profesional_perfil_url`.

**Registrar evaluación clínica (F3)**
- *Usuario:* registrás signos vitales (presión, frecuencia cardíaca, temperatura, glucosa, peso, hemoglobina) con rangos de referencia visibles. "Apto para donar" requiere firma manual en pantalla (distinta de la firma de perfil, verifica presencia física). "No apto" requiere motivo y firma; el turno se cierra.
- *Técnico:* persiste signos vitales y decisión en `donaciones`. Firma manual en `firma_profesional_manual_url` (diferenciada de `firma_profesional_perfil_url`, permite auditoría de identidad por comparación). `no_apto` → `apto: false` en `donaciones`, `estado: no_apto` en `turnos`, fin del flujo. La firma manual es obligatoria, no puede omitirse ni reemplazarse por la de perfil.

**Registrar extracción y generar QR post-donación**
- *Usuario:* si el donante fue apto, registrás la extracción: número de bolsa, volumen (ml), tipo de bolsa, horarios de inicio/fin, reacciones. Al confirmar se genera un QR (formulario F4 anónimo, sobre uso para transfusión) que se muestra antes de que el donante se retire; también podés enviar un link de respaldo a su casilla interna.
- *Técnico:* crea el registro definitivo en `donaciones`, actualiza `estado: completado` en `turnos`. Genera token único aleatorio en `formulario_postdonacion` vinculado a `numero_bolsa` (nunca a `usuario_id`), expiración 24h. `token_usado` y `completado_en` permiten medir tres estados en métricas: no escaneó / abrió sin completar / completó. El link de respaldo se registra como mensaje en `mensajes`.
