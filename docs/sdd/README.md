# SDD — Enterprise DataOps Platform

**Estado:** BASELINE / REVIEWED  
**Fecha:** 2026-08-24  
**Repositorio documental canónico:** `JuliusCordova/enterprise-dataops-platform-ui`  
**Frontend actual de referencia:** [Enterprise DataOps Platform — Cloud Run](https://enterprise-dataops-platform-ui-mkqutd4koq-uc.a.run.app)

> La URL anterior identifica el frontend actualmente utilizado como referencia funcional/visual. La relación exacta de la revisión desplegada con un SHA de GitHub e image digest continúa en estado `TO_VALIDATE` hasta completar la certificación de release.

## 1. Propósito

Este directorio define la fuente de verdad Spec-Driven Development (SDD) para las capacidades de **Perfilamiento y Calidad de Datos** y **Reconciliación / Cuadratura** de Enterprise DataOps Platform.

El producto se organiza en dos journeys gobernados, expuestos desde un único frontend/BFF:

1. **Data Quality Journey**  
   Seleccionar datos → perfilar → analizar hallazgos → diseñar reglas → validar → publicar/versionar → ejecutar on-demand o programado → revisar resultados y observabilidad.

2. **Reconciliation Journey**  
   Seleccionar origen y destino → definir claves, métricas, filtros y tolerancias → validar → publicar/versionar → ejecutar on-demand o programado → revisar diferencias y evidencia.

## 2. Principio de ownership

### Este repositorio (`enterprise-dataops-platform-ui`)

Es propietario de:

- experiencia web única;
- BFF/adaptadores por dominio;
- DTOs de integración;
- navegación y UX;
- contratos documentales del producto;
- SPEC, requisitos, criterios de aceptación y matriz de trazabilidad;
- evidencia de integración y release del frontend/BFF.

No debe contener una segunda copia del motor backend.

### Backend Jarvis (`JuliusCordova/intercorp-fest-agent`)

Es el repositorio ejecutable identificado para:

- profiling;
- calidad de datos;
- ejecución de reglas de calidad;
- configuración/versionado de calidad;
- reconciliación/cuadratura;
- configuración/versionado de reconciliación.

La implementación canónica revisada se encuentra actualmente en la rama `feature/data-quality-engine`, no consolidada en `main`.

### Silver Refinement (`JuliusCordova/bussinesrulessilver`)

Es un producto/backend separado para Bronze → Silver, transformación, mapeo, gobierno y AgentOps de Silver. No debe convertirse en una copia paralela del backend Jarvis de Quality/Reconciliation.

## 3. Documentos SDD

- [`SPEC-001-data-quality-lifecycle.md`](SPEC-001-data-quality-lifecycle.md)
- [`SPEC-002-reconciliation-lifecycle.md`](SPEC-002-reconciliation-lifecycle.md)
- [`requirements-functional.md`](requirements-functional.md)
- [`requirements-non-functional.md`](requirements-non-functional.md)
- [`ui-journey-evidence.md`](ui-journey-evidence.md) — catálogo de las capturas UX validadas y flujos Mermaid.
- [`traceability-code-baseline.md`](traceability-code-baseline.md)

## 4. Regla SDD

Todo incremento debe seguir:

`Necesidad → SPEC → RF/RNF → contrato → código → pruebas → evidencia → release`

Un requisito no se considera implementado solamente porque exista una pantalla o un endpoint. Debe tener trazabilidad hacia código ejecutable y evidencia de validación.

Toda modificación relevante del journey debe actualizar también la evidencia visual y el Mermaid asociado para evitar divergencia entre UX, SPEC y código.

## 5. Estados de cobertura

- `IMPLEMENTED`: existe código versionado y evidencia suficiente.
- `PARTIAL`: existe parte del flujo, pero falta contrato, UX, persistencia, ejecución o evidencia.
- `GAP`: no se encontró implementación versionada para la capacidad.
- `TO_VALIDATE`: existe código, pero debe certificarse contra el runtime desplegado.

## 6. Baseline de producto validado

A la fecha de este baseline:

- el frontend/BFF base está versionado en `main`;
- el frontend actual de referencia funcional está disponible en `https://enterprise-dataops-platform-ui-mkqutd4koq-uc.a.run.app`;
- la evolución V2 y documentación arquitectónica están en `architecture/backend-routing-matrix`, 20 commits por delante de `main`;
- el backend Quality/Reconciliation está versionado en `intercorp-fest-agent`, rama `feature/data-quality-engine`, 6 commits por delante de `main`;
- perfilamiento actual de BigQuery está implementado;
- publicación/versionado de configuraciones de Quality y Reconciliation está implementada en backend canónico;
- ejecución on-demand de Quality está implementada;
- ejecución on-demand de Reconciliation existe en el backend legacy/operativo y debe alinearse con la configuración canónica;
- perfilamiento histórico parametrizado no está cerrado;
- scheduling persistente/gestionado no fue encontrado y se considera GAP hasta implementación y certificación;
- la revisión exacta de Cloud Run aún debe vincularse a SHA/image digest para cerrar trazabilidad de release.

## 7. Regla de release

No promover a `main` ni desplegar una nueva versión sin conservar:

- SHA de frontend/BFF;
- SHA de cada backend propietario;
- contrato OpenAPI certificado;
- resultados de pruebas y smoke;
- imagen/digest desplegado o equivalente;
- matriz RF/RNF actualizada;
- evidencia visual cuando cambie el journey;
- URL/revisión del frontend desplegado;
- evidencia del ambiente validado.
