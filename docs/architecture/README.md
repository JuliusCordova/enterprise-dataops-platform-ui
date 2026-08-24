# Arquitectura del producto Enterprise DataOps Platform

Este directorio conserva las decisiones arquitectónicas, contratos API, matrices de rutas, planes de implementación y evidencia técnica del producto.

La definición funcional SDD de **Perfilamiento/Calidad** y **Reconciliación/Cuadratura** se encuentra en [`../sdd/README.md`](../sdd/README.md) y debe leerse como fuente de verdad funcional complementaria a esta arquitectura.

## Principios de gobierno documental

1. `enterprise-dataops-platform-ui` conserva la documentación canónica del producto.
2. Los repositorios backend contienen implementación ejecutable, pero no sustituyen esta documentación.
3. Ningún endpoint se considera aprobado sin método, ruta, DTO, evidencia y backend propietario.
4. No se simulan en frontend capacidades inexistentes en backend.
5. Las decisiones relevantes se formalizan mediante ADR o especificación versionada.
6. Todo requisito P0 debe tener trazabilidad SPEC → RF/RNF → contrato → código → prueba → evidencia → release.

## Documentos canónicos

### Arquitectura de la demo
- [Arquitectura AS-IS — Enterprise DataOps Demo](demo-as-is.md) — frontend Cloud Run, BFF, Jarvis, BigQuery, Gemini, ownership, Mermaid y brechas conocidas.

### SDD funcional
- [Índice SDD Quality & Reconciliation](../sdd/README.md)
- [SPEC-001 — Data Profiling & Quality Lifecycle](../sdd/SPEC-001-data-quality-lifecycle.md)
- [SPEC-002 — Reconciliation Lifecycle](../sdd/SPEC-002-reconciliation-lifecycle.md)
- [Requerimientos funcionales](../sdd/requirements-functional.md)
- [Requerimientos no funcionales](../sdd/requirements-non-functional.md)
- [Evidencia visual y journeys Mermaid](../sdd/ui-journey-evidence.md)
- [Trazabilidad y baseline de código](../sdd/traceability-code-baseline.md)

### Límites y routing
- [Backend routing matrix](backend-routing-matrix.md)
- [ADR-001: Frontend/backend boundaries and CRUD](adr-001-frontend-backend-boundaries-and-crud.md)
- [Code inventory: current and planned](code-inventory-current-and-planned.md)

### Contratos y CRUD
- [CRUD quality and reconciliation specification](crud-quality-reconciliation-spec.md)
- [Domain and persistence model](domain-persistence-model.md)
- [Implementation plan: quality and reconciliation CRUD](implementation-plan-quality-reconciliation-crud.md)

### Certificación y ejecución
- [Sprint A certified contract findings](sprint-a-certified-contract-findings.md)
- [Sprint C service-adapter matrix](sprint-c-service-adapter-matrix.md)
- [Execution order after contract certification](execution-order-after-contract-certification.md)

## Estructura objetivo

```text
docs/
├── sdd/
│   ├── README.md
│   ├── SPEC-001-data-quality-lifecycle.md
│   ├── SPEC-002-reconciliation-lifecycle.md
│   ├── requirements-functional.md
│   ├── requirements-non-functional.md
│   ├── ui-journey-evidence.md
│   └── traceability-code-baseline.md
├── architecture/
│   ├── README.md
│   ├── demo-as-is.md
│   ├── adr-*.md
│   ├── api-contracts/
│   ├── implementation-plans/
│   └── sprint-evidence/
├── operations/
└── releases/
```

## Estados documentales

- `DRAFT`: propuesta en elaboración.
- `REVIEWED`: revisada técnicamente.
- `APPROVED`: decisión vigente.
- `SUPERSEDED`: reemplazada por una versión posterior.
- `ARCHIVED`: conservada solo como referencia histórica.

## Regla de actualización

Todo cambio funcional o técnico que modifique contratos, responsabilidades o comportamiento del producto debe actualizar en el mismo PR:

- SPEC/RF/RNF afectados;
- código afectado;
- documento arquitectónico correspondiente;
- criterio de aceptación;
- evidencia de validación;
- referencia de release/commit cuando aplique.
