# Documentación de proyecto — Hemored

Estos documentos son el **norte del proyecto**: relevamiento, requisitos, decisión de arquitectura y documentación técnica/manual de uso. Se transcribieron a Markdown a partir de los PDF originales entregados para la materia "Prácticas profesionalizantes III" (última actualización de origen: 01/06/2026) para poder versionarlos junto al código y actualizarlos a medida que el prototipo evolucione.

## Índice

1. [**Relevamiento y requisitos**](./01-relevamiento-requisitos.md) — necesidades, requisitos funcionales/no funcionales, MoSCoW, casos de uso, arquitectura propuesta, diseño de API (53 endpoints / 15 servicios) y modelo de base de datos (20 tablas).
2. [**Matriz comparativa de alternativas**](./02-matriz-comparativa-alternativas.md) — comparación de 3 alternativas de solución (desarrollo propio / BaaS-Firebase / bot conversacional) y justificación de la elección.
3. [**Documentación técnica consolidada**](./03-documentacion-tecnica-consolidada.md) — versión integrada de lo anterior más el **manual de uso** completo por rol (donante, admin hospital, super admin, profesional de salud v2), con explicación técnica y en lenguaje natural para cada funcionalidad.
4. [**Estado actual del prototipo**](./04-estado-actual-prototipo.md) — auditoría flujo por flujo de lo que ya está codeado en `frontend/`: qué funciona hoy de punta a punta, qué está diseñado pero no conectado, y qué función de JS falta para cerrar cada gap. Es el documento de referencia para priorizar el trabajo pendiente.

## Cómo mantenerlos

- Son documentos vivos: a medida que el prototipo (`/index.html`, `/donante`, `/hospital`, `/admin`, `/profesional`, `/db`) cambie o se tomen nuevas decisiones, estos `.md` se actualizan en el mismo commit que el código relacionado.
- Los PDF originales (`PP3 - Grupo 3 - Hemored - Pte 1,2,3`, `Pte 4`, `Pte 5`) quedan como respaldo fuera del repo; esta carpeta es la fuente de verdad de trabajo.
- El modelo de datos descripto acá coincide con los fixtures JSON de [`/frontend/db`](../frontend/db).
