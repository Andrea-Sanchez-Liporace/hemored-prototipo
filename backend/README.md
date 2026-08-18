# Backend — Hemored (planificado)

Esta carpeta todavía no tiene código: es el lugar reservado para el backend real de HemoRed cuando arranque su implementación (ver Sprint 1 en [`/docs/01-relevamiento-requisitos.md`](../docs/01-relevamiento-requisitos.md#propuesta-de-ciclo-de-vida)).

## Stack definido

- **Lenguaje / framework:** Python + Django + Django REST Framework (DRF)
- **Base de datos:** PostgreSQL (20 tablas — modelo completo en [`/docs/01-relevamiento-requisitos.md`](../docs/01-relevamiento-requisitos.md#diseño-de-base-de-datos-y-modelo-de-datos))
- **Autenticación:** JWT, control de acceso basado en roles (`donante` / `admin_hospital` / `superadmin` / `profesional` en v2)
- **API:** REST, patrón `/api/{recurso}`, JSON — 53 endpoints en 15 servicios (detalle en el mismo documento)
- **Almacenamiento de archivos:** S3 (firmas digitales, PDFs de resultados/certificados)
- **Servicios externos previstos:** SendGrid (email), MercadoPago (pagos)

## Qué reemplaza

Hoy [`/frontend/db`](../frontend/db) simula la base de datos con JSONs estáticos que `frontend/js/db.js` carga por `fetch`. Cuando este backend exista, el frontend dejará de leer esos JSON directamente y consumirá la API REST (`/api/...`) en su lugar. Los JSON de `frontend/db` seguirán siendo útiles como fixtures/semillas para desarrollo y tests.

## Cómo se arma esta carpeta cuando empecemos

```
backend/
  manage.py
  hemored/            # settings del proyecto Django
  usuarios/            # apps por módulo funcional (ver "Módulos del sistema" en docs/01)
  hospitales/
  pacientes/
  campanas/
  turnos/
  donaciones/
  documentos/
  metricas/
  facturacion/
  mensajeria/
  requirements.txt
```

Los nombres de app deberían alinearse 1:1 con los módulos descriptos en la documentación para que el mapeo requisito → código sea directo.
