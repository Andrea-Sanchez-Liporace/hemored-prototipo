# Hemored — Documento de relevamiento y requisitos del sistema

**Integrantes equipo de análisis y desarrollo:** Sofía Páez, Natalia Sanchez Liporace, Andrea Sanchez Liporace
**Materia:** Prácticas profesionalizantes III
**Fecha de presentación:** 04/05/2026 · **Última actualización:** 01/06/2026

> Fuente original: `PP3 - Grupo 3 - Hemored - Pte 1, 2 y 3 - Act. 01_06_2026.pdf`

---

## Relevamiento de Información y Requisitos

### Descripción del sistema

**Sistema elegido:** Plataforma de gestión para campañas de donación de sangre.

**Descripción:** Se propone el desarrollo de un sistema que permita conectar hospitales con donantes de sangre, facilitando la gestión de solicitudes, turnos, donaciones y documentación asociada.

El sistema incluye funcionalidades operacionales (registro y gestión en tiempo real) y analíticas (visualización de métricas mediante dashboards). El diseño contempla además un módulo de atención clínica con gestión de profesionales de salud y formularios médicos digitales, previsto para la **versión 2** del sistema.

### Identificación de necesidades

1. Los donantes necesitan acceder fácilmente a solicitudes compatibles con su tipo de sangre.
2. Los donantes necesitan realizar la búsqueda de una campaña de donación y reservar un turno de manera sencilla.
3. Los hospitales necesitan gestionar campañas de donación de manera organizada y centralizada.
4. Los hospitales precisan gestionar los turnos de donación de forma simple y práctica.
5. Los hospitales y administradores necesitan visualizar métricas para la toma de decisiones.
6. Los hospitales necesitarán gestionar profesionales de salud vinculados a sus campañas y registrar el proceso de atención clínica del donante. *(v2)*

### Requisitos funcionales (QUÉ)

1. **RF1** — El sistema debe permitir a los donantes visualizar solicitudes disponibles y reservar turnos de donación.
2. **RF2** — El sistema debe permitir a los hospitales crear, publicar y gestionar campañas de donación de sangre.
3. **RF3** — El sistema debe permitir a los hospitales gestionar los turnos de donación solicitados por cada campaña de donación vigente.
4. **RF4** — El sistema debe permitir a los donantes y hospitales consultar el historial de donaciones realizadas.
5. **RF5** — El sistema debe permitir visualizar métricas de efectividad por campaña y globales del sistema.
6. **RF6** — El sistema debe permitir a los hospitales registrar el resultado del análisis de cada donación realizada.
7. **RF7** — El sistema debe notificar al donante el resultado de su análisis una vez que esté disponible.

> RF6 y RF7 están contemplados en el diseño del sistema. RF6 (registro de resultados) se implementa en el MVP como carga manual por parte del hospital. RF7 (notificación automática al donante) y el módulo completo de atención clínica están previstos para **v2**.

**Requisitos previstos para v2:**

8. **RF8** — Los profesionales de salud podrán registrar la evaluación clínica del donante y determinar su aptitud para donar.
9. **RF9** — El sistema gestionará el flujo de formularios médicos digitales previos y posteriores a la donación, incluyendo firma digital del donante y del profesional interviniente.

### Requisitos no funcionales (CÓMO)

1. Respuesta a consultas de campañas y turnos en ≤ 2 segundos para el 95% de las solicitudes.
2. Disponibilidad del 99% mensual, excluyendo mantenimientos programados.
3. Integridad y seguridad de datos mediante:
   - Autenticación con usuario y contraseña encriptada.
   - Control de acceso basado en roles (donante / administrador hospital / super admin).
   - Protección de datos sensibles conforme a normativas de privacidad.
4. Escalabilidad para soportar al menos 1000 usuarios concurrentes sin degradación significativa del rendimiento.

### User Story (v1)

- Como **donante**, quiero ver solicitudes de sangre compatibles con mi tipo para poder colaborar de forma rápida y efectiva.
- Como **administrador de un hospital**, quiero poder medir cuán efectiva es la convocatoria de cada campaña de donación vigente.

**User stories que se agregan en v2:**

- Como **profesional de salud**, quiero registrar la evaluación clínica del donante para poder determinar su aptitud y completar el proceso de donación de forma trazable.
- Como **donante**, quiero completar mis formularios médicos previos al turno desde la plataforma para llegar preparado a la donación.

### Priorización con MoSCoW

**Must Have (imprescindible)**
- Registro de usuarios (RF1)
- Reserva de turnos (RF1)
- Creación de campañas (RF2)
- Gestión de solicitudes de sangre (RF2)
- Gestión de turnos (RF3)

**Should Have (importante)**
- Historial de donaciones (RF4)
- Visualización de métricas por campaña (RF5)
- Registro de resultados de análisis por donación (RF6)
- Gestión de facturación y planes de suscripción hospitalaria
- Mensajería interna entre HemoRed y los hospitales

**Could Have (deseable)**
- Dashboard personalizado (RF5 extensión)
- Notificación del resultado clínico al donante (RF7)
- Notificaciones automáticas (RF7 extensión)

**Won't Have (fuera de alcance actual)**
- Integración con sistemas hospitalarios externos (HIS / INCUCAI)
- Aplicación mobile nativa (App Store / Google Play)
- Módulo de atención clínica: gestión de profesionales de salud, formularios médicos digitales y firma digital (previsto para v2)
- Notificación automática del resultado clínico al donante (RF7 — previsto para v2)

### Casos de uso

**Actores:** Donante · Administrador hospital · Super admin · Profesional de salud (v2)

**Donante:**
1. Buscar solicitudes de donación por campaña o paciente.
2. Reservar turno para donación.
3. Consultar historial de donaciones.

**Administrador del hospital:**
1. Registrar paciente.
2. Crear campaña de donación.
3. Gestionar solicitudes de turnos.
4. Gestionar facturación y plan de suscripción.
5. Gestionar profesionales de salud vinculados al hospital (v2).

**Super-admin:**
1. Gestionar (aprobar o rechazar) el registro de un hospital.
2. Gestionar usuarios del sistema.
3. Visualizar métricas globales de la plataforma.

**Profesional de salud (v2):**
1. Registrar firma digital en perfil.
2. Completar evaluación clínica del donante.
3. Registrar donación y emitir documentación/formulario de exclusión.

### Flujo de interacción entre casos de uso

**Flujo principal:**
1. El hospital registra al paciente que requiere donación.
2. El hospital crea una campaña con los datos necesarios.
3. El donante visualiza solicitudes compatibles y selecciona una campaña.
4. El donante reserva un turno disponible.
5. El hospital gestiona la solicitud (acepta/rechaza/cancela).
6. El donante consulta el estado desde su historial.

**Flujos alternativos:**
- **A1 — Donante no compatible:** el sistema filtra automáticamente y no muestra campañas incompatibles con el tipo de sangre del donante.
- **A2 — No hay turnos disponibles:** el sistema informa la falta de disponibilidad y permite elegir otra fecha o registrarse en lista de espera (opcional).
- **A3 — Campaña cerrada:** si alcanzó el cupo o expiró, se muestra como "cerrada" y no permite reservar turnos.
- **A4 — Rechazo de turno:** el donante recibe notificación y puede intentar con otra campaña.

### Propuesta de ciclo de vida

Metodología: **Scrum**, por permitir desarrollo incremental y validación continua con usuarios, adaptándose fácilmente a cambios de requisitos.

**Sprints (2 semanas c/u):**
- **Sprint 1:** modelo de datos y autenticación
- **Sprint 2:** gestión pacientes y campañas de donación
- **Sprint 3:** gestión de turnos e historial paciente
- **Sprint 4:** dashboards métricas para el rol administrador hospital
- **Sprint 5:** facturación, planes de suscripción y mensajería interna
- **Sprint 6 en adelante (v2):** módulo de atención clínica — profesionales de salud, formularios médicos, firma digital y formulario post-donación anónimo.

Durante cada sprint: revisiones con usuarios (hospitales), ajustes según feedback, validación de funcionalidades.

---

## Propuesta de Arquitectura de Sistemas

### Arquitectura propuesta

**Cliente-servidor con enfoque monolítico modular.**

- Dos clientes consumen la misma API REST: **aplicación web** (cubre los 4 roles: donante, admin hospital, super admin, profesional de salud v2) y **aplicación mobile** orientada exclusivamente al donante (ver campañas, confirmar turno, consultar historial, descargar comprobantes).
- El **servidor central** gestiona la lógica del negocio, el acceso a datos y las reglas del sistema.

### Justificación de la elección

Se opta por **monolítico** por:
- Complejidad moderada del sistema, sin necesidad de distribución en múltiples servicios.
- Facilita desarrollo inicial, mantenimiento y despliegue.
- Reduce sobrecarga técnica.
- Permite evolucionar hacia microservicios si el sistema escala.

**Alternativa descartada — Microservicios:** incrementa complejidad innecesariamente, requiere mayor esfuerzo en infraestructura, no se justifica en etapa inicial.

### Módulos del sistema (backend)

- **Módulo de Usuarios** — registro, autenticación, gestión de perfiles, manejo de roles.
- **Módulo de Pacientes** — registro de pacientes que requieren donación, asociación con campañas.
- **Módulo de Campañas** — creación, publicación y cierre, gestión de requisitos (tipo de sangre, cantidad, fechas).
- **Módulo de Turnos** — reserva por donantes, gestión de estados (pendiente, aceptado, rechazado).
- **Módulo de Historial** — registro de donaciones realizadas, consulta por el donante.
- **Módulo de Métricas** — dashboards para administradores, análisis de efectividad de campañas.
- **Módulo de Super admin** — aprobación y gestión de hospitales, administración de usuarios, métricas globales.
- **Módulo de Facturación y planes** — planes de suscripción hospitalaria (Local, Provincial, Nacional), emisión y seguimiento de facturas, historial de cambios de plan.
- **Módulo de Profesionales de salud** *(v2)* — registro y vinculación de profesionales a hospitales, gestión de firma digital.
- **Módulo de Atención clínica y formularios médicos** *(v2)* — flujo de 4 formularios digitales: autoexclusión predonación (F1), cuestionario médico (F2), evaluación clínica del profesional (F3), autoexclusión post-donación anónima (F4); firma digital; QR para formulario post-donación vinculado al número de bolsa.

### Patrón de arquitectura

**Arquitectura en capas** combinada con **MVC (Modelo-Vista-Controlador)**.

- **Presentación (Vista):** interfaz de usuario (web o mobile).
- **Aplicación (Controladores):** manejo de requests HTTP, validación de datos.
- **Negocio (Servicios):** lógica del sistema (reglas de compatibilidad, gestión de turnos, etc.).
- **Datos (Modelo/Persistencia):** acceso a base de datos.

**Beneficios:** separación clara de responsabilidades, facilita mantenimiento y testing, permite escalar por módulos.

---

## Interfaces y APIs

API REST como punto de comunicación único entre clientes (web y mobile) y servidor. Patrón `/api/{recurso}`, JSON, autenticación JWT (excepto endpoints públicos).

**15 servicios, 53 endpoints en total.**

### Servicios v1 (MVP)

| Servicio | Endpoints | Descripción general |
|---|---|---|
| `/api/auth` | 3 | Registro, login e invalidación de sesión |
| `/api/usuarios` | 4 | Gestión de perfiles y administración de cuentas |
| `/api/hospitales` | 6 | Registro, aprobación y gestión de hospitales, pacientes y profesionales |
| `/api/campanas` | 6 | Creación, publicación, gestión de estados y consulta de campañas |
| `/api/turnos` | 3 | Reserva, historial y gestión de estados de turnos |
| `/api/donaciones` | 3 | Registro de donaciones, historial del donante, generación formulario exclusión post-donación |
| `/api/documentos` | 4 | Carga, descarga y gestión de documentos clínicos |
| `/api/metricas` | 3 | Dashboards por campaña, hospital y métricas globales del sistema |
| `/api/planes` | 3 | Listar planes disponibles, ver detalle y actualizar precio/promoción |
| `/api/facturas` | 4 | Emitir facturas, listar por hospital, ver detalle y registrar pago |
| `/api/mensajes` | 3 | Enviar mensajes entre HemoRed y hospitales, listar y marcar como leído |

### Servicios v2 — módulo de atención clínica

*(documentados ahora porque el modelo de datos ya contempla su implementación a futuro)*

| Servicio | Endpoints | Descripción general |
|---|---|---|
| `/api/profesionales` | 4 | Gestionar perfil, registrar y actualizar firma digital, ver historial de atenciones |
| `/api/formularios/consentimiento` | 3 | Registrar F1 (autoexclusión), F2 (cuestionario médico) y consultar por donación |
| `/api/formularios/evaluacion` | 2 | Registrar F3 (evaluación clínica del profesional) y consultar por donación |
| `/api/formularios/postdonacion` | 2 | Validar token QR y registrar respuesta anónima post-donación |

### Endpoints representativos

**Endpoint 1 — Consulta de campañas:** `GET /api/campanas`
Parámetros opcionales: `tipo_sangre`, `estado` (activa/cerrada), `hospital`, `paciente`.
```json
[
  {
    "id": 1,
    "paciente": "Juan Pérez",
    "tipo_sangre": "A+",
    "fecha_limite": "2026-06-01",
    "estado": "activa"
  }
]
```

**Endpoint 2 — Reservar turno:** `POST /api/turnos`
Parámetros: `id_donante`, `id_campana`, `fecha`, `hora`.
```json
{
  "mensaje": "Turno solicitado correctamente",
  "estado": "pendiente"
}
```

**Endpoint 3 — Obtener métricas:** `GET /api/metricas`
Parámetro: `id_campana`.
```json
{
  "total_turnos": 50,
  "turnos_confirmados": 30,
  "turnos_cancelados": 5,
  "efectividad": "60%"
}
```

### Manejo de errores

Códigos de estado HTTP estándar:

| Código | Estado | Descripción |
|---|---|---|
| 200 | OK | La solicitud se procesó correctamente y devuelve datos. |
| 201 | Created | Se creó un recurso correctamente (ej: nuevo turno, nueva campaña). |
| 400 | Bad request | Datos enviados inválidos o incompletos (ej: falta `tipo_sangre` en una campaña). |
| 401 | Unauthorized | Token JWT no enviado, inválido o expirado. |
| 403 | Forbidden | Usuario autenticado sin permisos para la acción (ej: un donante intenta crear una campaña). |
| 404 | Not found | Recurso solicitado no existe (ej: campaña con id inexistente). |
| 409 | Conflict | Conflicto con el estado actual del recurso (ej: el donante ya tiene un turno reservado para esa campaña). |
| 500 | Internal server error | Error inesperado del servidor. |

Ejemplo de respuesta de error:
```json
{
  "error": "No autorizado",
  "codigo": 401,
  "detalle": "El token de sesión expiró. Por favor volvé a iniciar sesión."
}
```

---

## Diseño de base de datos y modelo de datos

**20 tablas organizadas en cinco grupos:**

1. **6 entidades principales:** `usuarios` (donantes, admin hospital, super admin, profesional de salud — discriminados por campo `rol`), `hospitales`, `pacientes`, `profesionales`, `campanas`, `donaciones`.
2. **3 tablas intermedias (N:M):** `turnos`, `paciente_hospital`, `profesional_hospital`.
3. **2 tablas del sistema de documentos (herencia):** `tipo_documento` (catálogo), `documentos` (concentra las relaciones — nodo central).
4. **3 tablas hijas del sistema de documentos:** `formulario_consentimiento`, `certificado_donacion`, `resultado_analisis` — guardan hoy el PDF; diseñadas para incorporar campos estructurados en el futuro sin modificar la estructura existente.
5. **4 tablas de facturación y comunicación (activas desde v1):** `planes`, `facturas`, `medios_pago`, `mensajes`; más `hospital_plan_historial` para auditar cambios de plan.
6. **2 tablas del módulo de atención clínica (v2, incluidas desde el diseño inicial):** `formulario_consentimiento` (concentra F1/F2/F3 con firmas digitales — ver detalle abajo) y `formulario_postdonacion` (F4 anónimo, vinculado al número de bolsa, no al usuario).

### Detalle de tablas clave

**`usuarios`** — `id (PK)`, `nombre`, `email`, `password_hash`, `tipo_sangre`, `rol (enum)`, `fecha_nacimiento`, `telefono`, `activo (bool)`.
> Unifica donante, admin hospital y super admin en una sola tabla usando el campo `rol`. Evita duplicar lógica de autenticación.

`tipo_sangre` es autoreportado por el donante en su perfil y, al igual que `experiencia_donante` (ver abajo), es de **escritura única**: una vez guardado, el perfil lo bloquea (no se puede volver a editar desde la UI). Motivo: es un dato médico que en algún momento necesita verificación real, no una preferencia que el donante deba poder corregir libremente. **Pendiente de diseño (anotado para no perderlo, no implementado todavía):** el mecanismo real de verificación/corrección de este dato — la idea es que se confirme (o corrija, si el donante se equivocó) recién en la primera donación real a través de HemoRed, por un profesional de salud durante la atención clínica (`profesional/dashboard.html`, ver `docs/04`), o alternativamente por el hospital al cargar el resultado del análisis (`hospital/documentacion.html`, `cargarResultadoAnalisis()`). Ninguno de esos dos flujos toca hoy `usuarios.tipo_sangre` — hay que decidir cuál es la fuente de verdad definitiva cuando se aborde esa parte.

Campos adicionales específicos del rol donante (agregados 2026-09-01, ver `docs/04-estado-actual-prototipo.md` para el detalle de implementación):
- `experiencia_donante (enum: primera_vez | ocasional | habitual)` — autoreporte general en el perfil, capturado/editable como una foto en el tiempo, **no** atado a una donación puntual. Aclarar siempre en el copy de UI que se refiere a donaciones **previas al registro en HemoRed** (por eso vive en el perfil y no se recalcula desde la tabla `donaciones` — el sistema no puede saber de donaciones hechas en otro lado antes de unirse a la plataforma).
- `ultima_donacion_fecha (fecha, opcional)`, `ultima_donacion_fecha_aproximada (enum: ultimo_mes | ultimos_3_meses | mas_de_6_meses, opcional)`, `ultima_donacion_lugar (texto, opcional)` — solo tienen sentido si `experiencia_donante` es `habitual` u `ocasional`; en la UI del perfil se muestran/ocultan según esa respuesta. `fecha` y `fecha_aproximada` son mutuamente excluyentes (si el donante no recuerda la fecha exacta, se guarda la aproximada y la exacta queda en null, nunca las dos a la vez).
- **Escritura única:** `experiencia_donante` y los 3 campos de última donación son un dato histórico, no una preferencia editable — una vez que el donante los guarda (con cualquier respuesta, incluida "primera vez"), el perfil los bloquea permanentemente (mismo tratamiento que el email: se puede ver pero no volver a tocar desde la UI). Motivo de negocio: no tiene sentido que alguien "deje de haber donado antes"; permitir editarlo libremente habilitaría datos contradictorios sin ningún control. La única forma de que quede en blanco de nuevo en este prototipo es un reset completo de los datos de demo (`localStorage`) — no hay una función de "corregir" este dato desde el perfil.
- `condiciones_medicas (texto, opcional)` — información confidencial visible solo para el personal médico al momento de la donación.
- `notif_recordatorio_turno`, `notif_resultado_analisis`, `notif_campanas_urgentes` (booleanos) — preferencias de notificación del donante.

**Importante — esto NO es lo mismo que los campos homónimos de `formulario_consentimiento` (F2, más abajo):** son dos preguntas distintas que capturan información parecida en dos momentos distintos, a propósito, no por descuido:
- Los campos de `usuarios` (esta tabla) son la respuesta del donante en su **perfil general**, capturada/editable en cualquier momento, no atada a ningún turno puntual.
- Los campos de `formulario_consentimiento` se vuelven a preguntar en **cada proceso de donación** (F2, cuestionario médico previo a esa donación específica), porque la vigencia médica de esa información se degrada con el tiempo y es distinta en cada turno.
- No hay sincronización automática entre ambos: completar uno no completa el otro. Si en el futuro se decide autocompletar el F2 con el valor más reciente del perfil como sugerencia, dejarlo anotado ahí, pero hoy son independientes.

**`hospitales`** — `id (PK)`, `nombre`, `direccion`, `telefono`, `email`, `estado (enum)`, `usuario_id (FK)`.
> El campo `estado` (pendiente/aprobado/suspendido) permite al super admin controlar qué hospitales pueden operar.

**`pacientes`** — `id (PK)`, `nombre`, `tipo_sangre`, `diagnostico`, `urgencia (enum)`.
> Un paciente puede atenderse en más de un hospital a lo largo del tiempo → relación N:M resuelta con `paciente_hospital`.

**`profesionales`** *(v2)* — `id (PK)`, `nombre`, `matricula (único)`, `especialidad`.
> El hospital carga quién atendió cada donación. Un profesional puede trabajar en más de un hospital — relación N:M con `profesional_hospital`. No tiene login propio (v1); en v2 sí.

**`campanas`** — `id (PK)`, `hospital_id (FK)`, `paciente_id (FK?)`, `tipo_sangre`, `cantidad_donantes`, `fecha_limite`, `estado (enum)`, `descripcion`.
> `paciente_id` es nullable: una campaña puede ser genérica (banco de sangre) o específica para un paciente identificado.

**`donaciones`** — `id (PK)`, `turno_id (FK)`, `profesional_id (FK)`, `fecha_donacion`, `apto (bool)`, `notificado (bool)`.
> Separa el turno (intención) de la donación (hecho real). Un turno puede cancelarse — solo existe donación cuando el donante se presentó efectivamente.

**`tipo_documento`** — `id (PK)`, `nombre`, `descripcion`, `activo (bool)`.
> Catálogo administrado por el super admin. Permite agregar tipos de documento sin tocar código ni estructura de BD.

**`documentos`** — `id (PK)`, `tipo_documento_id (FK)`, `donacion_id (FK)`, `donante_id (FK)`, `solicitud_id (FK?)`, `profesional_id (FK?)`, `fecha_carga`, `version`.
> Nodo central. Concentra todas las relaciones. Patrón Table Inheritance.

**`formulario_consentimiento`** (tabla hija docs) — `id (PK)`, `documento_id (FK único)`, `archivo_url`, `fecha_carga`.
> Hoy guarda el PDF firmado por el donante. En v2 se agregan campos estructurados sin tocar la tabla padre.

**`certificado_donacion`** — `id (PK)`, `documento_id (FK único)`, `archivo_url`, `fecha_carga`.
> Comprobante descargable por el donante. Prueba legal de que donó. En v2: número de certificado, volumen, tipo de donación.

**`resultado_analisis`** — `id (PK)`, `documento_id (FK único)`, `archivo_url`, `fecha_carga`.
> El hospital sube el PDF del análisis. En v2 se agregan campos como hemoglobina, hematocrito, enfermedades detectadas.

**`turnos`** — `id (PK)`, `usuario_id (FK)`, `campana_id (FK)`, `fecha_turno`, `estado (enum)`.
> Resuelve N:M entre donantes y campañas. Un donante puede anotarse a muchas campañas, una campaña puede tener muchos donantes.

**`paciente_hospital`** — `paciente_id (FK)`, `hospital_id (FK)`, `fecha_ingreso`.
**`profesional_hospital`** — `profesional_id (FK)`, `hospital_id (FK)`, `fecha_desde`, `fecha_hasta (null?)`.
> `fecha_hasta` NULL significa que la relación sigue activa.

**`planes`** *(nueva v1)* — `id (PK)`, `nombre`, `precio_mensual`, `max_campanas_simultaneas`, `alcance (enum: local/provincial/nacional)`, `activo (bool)`.
> Catálogo de planes de suscripción disponibles para hospitales. `alcance` determina la visibilidad de las campañas. Administrado por el super admin.

**`hospital_plan_historial`** *(nueva v1)* — `id (PK)`, `hospital_id (FK)`, `plan_id (FK)`, `fecha_desde`, `fecha_hasta (null?)`, `cambiado_por (enum: admin/hospital)`, `motivo`.
> Auditoría de cambios de plan por hospital. `fecha_hasta` NULL indica que el plan sigue activo.

**`facturas`** *(nueva v1)* — `id (PK)`, `hospital_id (FK)`, `plan_id (FK)`, `periodo`, `monto`, `estado (enum: pagada/pendiente/vencida)`, `fecha_emision`, `fecha_vencimiento`, `fecha_pago (null?)`, `medio_pago_id (FK?)`.
> Facturación mensual de hospitales. `medio_pago_id` es nulo hasta que se registra el pago. Cada hospital tiene un período único por factura.

**`medios_pago`** *(nueva v1)* — `id (PK)`, `hospital_id (FK)`, `tipo (enum: transferencia/tarjeta/cheque/otro)`, `descripcion`, `activo (bool)`.

**`mensajes`** *(nueva v1)* — `id (PK)`, `hospital_id (FK)`, `remitente (enum: admin/hospital)`, `asunto`, `cuerpo`, `leido (bool)`, `fecha_envio`.
> Casilla interna entre HemoRed (super admin) y los hospitales. No es chat en tiempo real, es bandeja asíncrona. El badge de notificaciones no leídas se alimenta de esta tabla.

**`formulario_consentimiento`** *(v2, campos completos)* — `id (PK)`, `donacion_id (FK único)`, `autoexclusion_completado_por (enum)`, `cuestionario_completado_por (enum)`, `firma_donante_url`, `firma_profesional_perfil_url`, `firma_profesional_manual_url`, `fecha_completado`.
> Concentra F1 (autoexclusión), F2 (cuestionario médico) y F3 (evaluación clínica) de cada donación. Los campos `_completado_por` son marcas de seguimiento para métricas de flujo. Doble firma del profesional permite auditoría de identidad.

Campos adicionales de F2, agregados 2026-09-01 (todavía sin implementar — quedan documentados acá para cuando se aborde el flujo de formularios pre-donación, ver "Próximos pasos — Donante" en `docs/04-estado-actual-prototipo.md`):
- `ultima_donacion_fecha (fecha, opcional)` — si el donante recuerda la fecha exacta de su última donación.
- `ultima_donacion_fecha_aproximada (enum: ultimo_mes | ultimos_3_meses | mas_de_6_meses, opcional)` — se completa solo si no marcó la fecha exacta.
- `ultima_donacion_lugar (texto, opcional)` — dónde fue esa última donación.

Esta es la versión de "¿donaste antes?" atada a un proceso de donación puntual — se vuelve a preguntar en cada turno porque es información médicamente relevante (define si puede donar de nuevo) y se desactualiza con el tiempo. Es un conjunto de campos distinto de `usuarios.experiencia_donante`/`usuarios.ultima_donacion_*` (foto general del perfil, editable en cualquier momento, no atada a un turno) — ver la nota completa en la definición de `usuarios` más arriba. No duplicar la lógica entre ambos ni sincronizarlos automáticamente.

**`formulario_postdonacion`** *(v2)* — `id (PK)`, `numero_bolsa (único)`, `token (único)`, `token_expira_en`, `token_usado (bool)`, `usar_para_transfusion (null?)`, `completado_en (null?)`.
> Formulario F4 — autoexclusión post-donación anónima. Se vincula al `numero_bolsa`, nunca al `usuario_id`, garantizando el anonimato. `usar_para_transfusion` NULL hasta completarse. Token de un solo uso, válido 24 horas.

### Relaciones entre entidades

- **usuarios – hospitales:** 1:1. El hospital tiene `usuario_id` que lo vincula al usuario administrador.
- **usuarios – turnos:** 1:N. Un donante puede reservar muchos turnos a lo largo del tiempo.
- **hospitales – campanas:** 1:N. Cada campaña pertenece a un único hospital.
- **pacientes – campanas:** 1:N opcional. Una campaña puede ser genérica sin paciente específico (permite campañas masivas a futuro).
- **campanas – turnos:** 1:N. Cada turno corresponde a una única campaña.
- **turnos – donaciones:** 1:1. Un turno puede derivar en una donación efectiva; no todo turno genera donación (puede cancelarse).
- **profesionales – donaciones:** 1:N. Un profesional puede atender muchas donaciones.
- **usuarios – campanas – turnos:** N:M resuelta por `turnos` (agrega fecha y estado).
- **pacientes – hospitales – paciente_hospital:** N:M, registra fecha de ingreso.
- **profesionales – hospitales – profesional_hospital:** N:M, registra fecha_desde/fecha_hasta (NULL = activo).
- **tipo_documento – documentos:** 1:N.
- **donaciones – documentos:** 1:N (formulario de consentimiento, certificado, resultado de análisis).
- **documentos – (formulario_consentimiento / certificado_donacion / resultado_analisis):** 1:1 en cada caso, garantizado por UNIQUE sobre `documento_id`.
- **donaciones – formulario_consentimiento:** 1:1. Concentra F1, F2 y F3.
- **donaciones – formulario_postdonacion:** 1:1 opcional, vía número de bolsa (no usuario_id) para garantizar anonimato.
- **hospitales – planes:** N:1. Historial de cambios en `hospital_plan_historial`.
- **hospitales – facturas:** 1:N.
- **hospitales – mensajes:** 1:N.

### Justificación global de la arquitectura

- La estructura cliente-servidor monolítica permite un desarrollo ágil y controlado, ideal para una primera versión.
- El diseño modular facilita la organización del código y permite escalar funcionalidades de forma progresiva.
- El uso de APIs REST garantiza una comunicación clara y desacoplada entre frontend y backend.
- La arquitectura en capas mejora la mantenibilidad y separación de responsabilidades.
- El modelo de datos refleja correctamente las relaciones del negocio y contempla el crecimiento del sistema: las 20 tablas incluyen tanto el MVP como las tablas del módulo de atención clínica previstas para v2, **evitando migraciones estructurales al momento de su implementación**.
