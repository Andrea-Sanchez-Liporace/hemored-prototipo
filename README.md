# HemoRed

Plataforma de gestión de campañas de donación de sangre: conecta hospitales con donantes, centralizando la publicación de campañas, la reserva de turnos, el registro de donaciones y las métricas de efectividad — hoy coordinado de forma informal por redes sociales y WhatsApp.

Proyecto desarrollado para la materia **Prácticas Profesionalizantes III** por Sofía Páez, Natalia Sanchez Liporace y Andrea Sanchez Liporace.

📄 Documentación completa (relevamiento, requisitos, arquitectura, modelo de datos, manual de uso): **[`/docs`](./docs)**

## Estado actual del proyecto

Este repositorio contiene hoy un **prototipo navegable**: HTML/CSS/JS vanilla que simula el flujo completo de la aplicación para los 3 roles del MVP (donante, administrador de hospital, super admin), con una base de datos simulada en archivos JSON consumidos por `fetch` en el cliente. No hay backend real todavía — es la etapa de validación de UX/flujos antes de la implementación con el stack definitivo.

> Nota: el prototipo está en HTML/CSS/JS plano, no en React como propone la arquitectura objetivo (ver abajo). Es una decisión pendiente si el frontend definitivo se reescribe en React sobre esta base o si esta capa se conecta directamente a la API REST del backend conservando su estructura actual.

## Arquitectura objetivo

Cliente-servidor con **enfoque monolítico modular** (ver justificación completa y alternativas descartadas en [`docs/02-matriz-comparativa-alternativas.md`](./docs/02-matriz-comparativa-alternativas.md)):

```
CAPA DE PRESENTACIÓN — Clientes
  ├─ Aplicación Web (React — objetivo)
  └─ App Mobile — v2 (donante)
          │  HTTPS / JSON
          ▼
CAPA DE APLICACIÓN — API REST
  Django REST Framework · Autenticación JWT · Endpoints /api/{recurso}
          ▼
CAPA DE NEGOCIO — Lógica del sistema
  Reglas de compatibilidad sanguínea · Estados de campañas · Gestión de roles · Facturación
          ▼
CAPA DE DATOS — Persistencia
  PostgreSQL · ORM Django (20 tablas) · S3 (archivos)
```

- **Backend:** Python (Django + Django REST Framework), PostgreSQL, JWT, API REST con 53 endpoints en 15 servicios.
- **Frontend:** SPA en React (objetivo) para los 4 roles del sistema; app mobile orientada al donante (v2).
- **Roles:** donante, administrador de hospital, super admin, y profesional de salud (módulo de atención clínica, previsto para v2).

Detalle completo de requisitos, API, modelo de base de datos (20 tablas) y manual de uso por rol: **[`docs/01-relevamiento-requisitos.md`](./docs/01-relevamiento-requisitos.md)** y **[`docs/03-documentacion-tecnica-consolidada.md`](./docs/03-documentacion-tecnica-consolidada.md)**.

## Estructura del repositorio

```
/frontend   — prototipo navegable actual (HTML/CSS/JS + BD simulada en JSON) — esto es lo único que se publica en GitHub Pages
/backend    — reservado para la implementación Django + DRF + PostgreSQL (aún sin código)
/docs       — documentación viva del proyecto: requisitos, arquitectura, BD, manual de uso
/tests      — test automatizado (Playwright) del camino feliz del frontend — deliberadamente fuera de /frontend
```

## Tecnologías de desarrollo y testing local

Estas herramientas **no son parte de la aplicación** (que sigue siendo HTML/CSS/JS plano, sin build ni runtime propio) — son solo lo que se usa en la máquina de cada una para levantarlo y probarlo mientras se desarrolla:

| Para qué | Tecnología | Ya instalada / hace falta instalar |
|---|---|---|
| Servir el prototipo localmente | Servidor HTTP estático — `http.server`, módulo incluido con **Python** (no hay que instalar nada aparte) | Viene con Python. Alternativa sin Python: `npx serve` (usa **Node.js**, que además hace falta si vas a correr los tests) |
| Test automatizado end-to-end | **Playwright** (librería de Node.js que controla un navegador Chromium real y simula clicks/formularios) | Requiere **Node.js** + `npm install` dentro de `/tests` — ver detalle abajo |

No hay que instalar nada de esto para que la app funcione en producción — son solo herramientas de desarrollo/QA local, separadas del stack de producción real (ver "Arquitectura objetivo" arriba: ese sí es Python/Django/PostgreSQL, pero para el *backend*, no para correr este prototipo).

## Cómo correr el prototipo frontend

El prototipo usa `fetch` para cargar los JSON de `frontend/db`, por lo que hay que servirlo con un servidor local (abrirlo como `file://` rompe esas cargas por CORS). Por ejemplo:

```bash
cd frontend
python -m http.server 8000
# o, si no tenés Python instalado pero sí Node.js:
npx serve .
```

Luego abrir `http://localhost:<puerto>/index.html`. Usuarios de prueba disponibles en [`frontend/db/demo_acceso.json`](./frontend/db/demo_acceso.json).

## Tests

Hay un test automatizado con **Playwright** que abre el prototipo en un Chromium real y recorre el camino feliz principal (registro de donante → reserva de turno → confirmación por el hospital) — ver [`/tests`](./tests) para instalación, cómo correrlo, qué cubre y qué falta. Vive en la raíz del repo (no adentro de `frontend/`) a propósito, para quedar afuera de lo que se publica en GitHub Pages.
