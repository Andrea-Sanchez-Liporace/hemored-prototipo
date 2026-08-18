# Hemored — Matriz comparativa de alternativas / Selección de la solución óptima

**Integrantes:** Sofía Páez, Natalia Sanchez Liporace, Andrea Sanchez Liporace
**Materia:** Prácticas profesionalizantes III
**Fecha de presentación:** 11/05/2026 · **Última actualización:** 01/06/2026

> Fuente original: `PP3 - Grupo 3 - Hemored - Pte 4 - Act. 01_06_2026.pdf`

---

## Definición del contexto

**HemoRed** es una plataforma web y mobile para la gestión de campañas de donación de sangre. Conecta hospitales con donantes, facilitando la publicación de campañas, la reserva de turnos, el registro de donaciones y la visualización de métricas de efectividad.

**Tipo de aplicación:** Sistema web multicapa — frontend web en React + app mobile orientada al donante, ambos consumiendo una API REST centralizada. Backend en **Python (Django + Django REST Framework)**. Base de datos relacional **PostgreSQL**.

**Usuarios principales:**
- **Donante:** ve campañas activas, reserva turnos, consulta historial de donaciones.
- **Administrador hospital:** crea y gestiona campañas, registra pacientes, administra la suscripción. *(Gestión de profesionales de salud y carga de documentación clínica: v2)*
- **Super admin:** aprueba hospitales, gestiona usuarios, monitorea métricas globales.
- **Profesional de salud** *(desde v2)*: registra donaciones, completa y valida formularios de extracción, genera formularios de exclusión post-donación.

**Problema a resolver:** Hoy la convocatoria de donantes se realiza de forma desorganizada por redes sociales y WhatsApp. Esto genera demoras en campañas urgentes, falta de trazabilidad de donaciones y dificultad para medir efectividad. HemoRed centraliza el proceso, reduce tiempos de coordinación y ofrece métricas en tiempo real.

---

## Generación de alternativas

### Alternativa 1: Desarrollo propio

Diseñar y construir el sistema desde cero. Arquitectura monolítica modular con API REST, base de datos relacional propia, dos clientes diferenciados (web + mobile).

**Alcance:** gestión de campañas/turnos/donaciones (+ documentación clínica en futuras versiones); 3 roles diferenciados; dashboard de métricas; modelo de 20 tablas con N:M, herencia de documentos y escalabilidad hacia v2; API REST con 30 endpoints en 8 servicios *(cifra preliminar de esta etapa — luego consolidada en 53 endpoints/15 servicios, ver `01-relevamiento-requisitos.md`)*.

**Ventajas:** control total sobre funcionalidades, datos y arquitectura; adaptado exactamente al dominio (compatibilidad sanguínea, flujos de turnos, documentación clínica); sin costos de licencia ni dependencia de proveedores externos; escalable y mantenible por el equipo propio.

### Alternativa 2: Solución híbrida con backend como servicio (BaaS)

Usar Firebase (Google) para base de datos, autenticación y almacenamiento; desarrollar solo el frontend.

**Alcance:** frontend propio (web y mobile); BD/auth/almacenamiento gestionados por Firebase; lógica de negocio en frontend o funciones serverless; sin gestión de servidores propios.

**Ventajas:** reduce tiempo de desarrollo de backend; auth + BD en tiempo real + almacenamiento de fábrica; tecnologías modernas y ampliamente usadas en salud digital; escalabilidad automática gestionada por el proveedor.

### Alternativa 3: Bot conversacional (WhatsApp)

Bot automatizado para gestionar la comunicación entre hospitales y donantes.

**Alcance:** consulta de campañas y reserva de turnos por mensaje; notificaciones automáticas por cercanía/interés; panel de administración básico para el hospital; implementación vía APIs de Twilio (WhatsApp).

**Ventajas:** canal ya usado cotidianamente por los donantes (baja barrera de adopción); implementación más rápida que una app completa; costo operativo bajo; adoptado por bancos de sangre en varios países de América Latina.

**Limitación central:** cubre únicamente la interfaz de comunicación con el donante — no es un sistema de gestión completo. No contempla gestión hospitalaria, documentación clínica futura, dashboards de métricas ni roles diferenciados.

---

## Criterios de evaluación

| Criterio | Peso | Justificación |
|---|---|---|
| Costo de implementación | 20% | El costo inicial es determinante para la viabilidad. No hay financiamiento externo. |
| Adaptabilidad al dominio | 20% | El sistema debe contemplar lógica específica: flujos de notificación, documentación clínica, roles diferenciados. |
| Escalabilidad | 15% | Debe poder crecer en usuarios, hospitales y funcionalidades sin reescribirse desde cero. |
| Mantenibilidad | 15% | El equipo debe poder mantener y actualizar el sistema sin depender de terceros. |
| Tiempo de implementación | 10% | El prototipo funcional debe estar listo en 3 meses para el MVP. |
| Seguridad y privacidad de datos | 20% | Se manejan datos clínicos sensibles de donantes y pacientes. |
| **Total** | **100%** | |

## Matriz comparativa

Escala: 1 = muy bajo/desfavorable · 2 = bajo · 3 = aceptable · 4 = alto/favorable · 5 = muy alto/favorable.

| Criterio | Peso | Desarrollo propio (calif. / pond.) | Solución híbrida BaaS (calif. / pond.) | Bot conversacional (calif. / pond.) |
|---|---|---|---|---|
| Costo de implementación | 20% | 5 / 20% | 3 / 12% | 4 / 16% |
| Adaptabilidad al dominio | 20% | 5 / 20% | 2 / 10% | 1 / 5% |
| Escalabilidad | 15% | 4 / 12% | 4 / 12% | 2 / 6% |
| Mantenibilidad | 15% | 5 / 15% | 2 / 6% | 2 / 6% |
| Tiempo de implementación | 10% | 3 / 6% | 4 / 12% | 5 / 15% |
| Seguridad y privacidad de datos | 20% | 5 / 20% | 2 / 4% | 2 / 4% |
| **Total ponderado** | **100%** | **4.5 — 93%** | **2.8 — 56%** | **2.67 — 52%** |

---

## Selección de la solución óptima

### Alternativa seleccionada: 1. Desarrollo propio (4.5 / 5)

**Relación con el contexto:** la app gestiona información clínica sensible (datos de pacientes, resultados de análisis en futuras versiones, documentación firmada). Este tipo de sistema requiere control preciso sobre flujos de datos, roles de acceso y lógica de negocio específica del dominio — ninguna alternativa evaluada puede contemplar esta especificidad sin comprometer integridad, privacidad o gestión hospitalaria completa.

**Criterios más relevantes en la decisión:**
- **Adaptabilidad al dominio (20%):** máxima calificación para desarrollo propio — estados de campañas, flujos de turnos y documentos clínicos no pueden replicarse en las otras alternativas sin perder funcionalidad crítica.
- **Seguridad y privacidad (20%):** mejor control de acceso por roles, encriptación y almacenamiento propio. La alternativa híbrida almacena datos en servidores de Google — riesgo de privacidad para un sistema de salud.
- **Mantenibilidad (15%):** ser dueños del código fuente permite mantener y modificar sin depender de proveedores ni soporte externo, y garantizar escalabilidad con independencia.

### Por qué se descarta la Alternativa 2 (Firebase/BaaS)

Reduce tiempo de desarrollo de backend, pero su debilidad determinante: los datos clínicos quedan almacenados en servidores de terceros (Google Firebase) — riesgo de privacidad para un sistema de salud. Además, la lógica de negocio específica (documentación clínica, control de roles hospitalarios) es difícil de implementar con reglas de BD del proveedor y funciones serverless, generando una solución fragmentada y de difícil mantenimiento.

### Por qué se descarta la Alternativa 3 (Bot conversacional)

Es la alternativa más cercana a la realidad actual (los hospitales ya coordinan por WhatsApp informalmente), pero es una solución parcial: cubre solo la comunicación con el donante, no un sistema de gestión. No contempla gestión hospitalaria, dashboards, documentación clínica, gestión de pacientes/profesionales ni roles diferenciados. Además, la dependencia de las políticas comerciales de WhatsApp puede restringir o discontinuar el acceso a la API sin previo aviso — riesgo operativo.

---

## Conclusión

La solución elegida es el **desarrollo propio** de HemoRed, con puntaje ponderado de **4.5/5**.

**Beneficios que aporta:**
- Control total sobre lógica de negocio, datos y arquitectura, sin dependencia de proveedores externos.
- Capacidad de implementar flujos específicos del dominio: gestión de turnos, documentación clínica con herencia de tablas, notificación de resultados.
- Escalabilidad progresiva: el sistema puede crecer sin reescribirse, gracias al diseño modular y al patrón Table Inheritance en la BD. El esquema de 20 tablas contempla tanto el MVP como el módulo de atención clínica de v2, sin requerir modificar la estructura existente.
- Independencia tecnológica: el equipo es dueño del código fuente.
- Costo de implementación reducido: tecnologías 100% open source (Python Django, PostgreSQL, React) y despliegue en infraestructura de bajo costo.

**Impacto esperado:** reducir significativamente los tiempos de coordinación entre hospitales y donantes, reemplazando la comunicación por redes sociales con un sistema centralizado, trazable y medible. Para los hospitales, el dashboard permite evaluar efectividad de campañas y decidir con datos. Para los donantes, simplifica encontrar campañas y gestionar turnos desde cualquier dispositivo. A escala, puede convertirse en herramienta de salud pública para reducir la escasez de sangre en el sistema hospitalario argentino, con potencial de extenderse a otro tipo de donaciones similares (plasma, plaquetas).
