# Arquitectura del producto Enterprise DataOps Platform

Este directorio es la fuente de verdad documental del producto. Toda decisión arquitectónica, contrato API, matriz de rutas, plan de implementación, evidencia de certificación y criterio de aceptación debe quedar registrada aquí.

## Principios de gobierno documental

1. `enterprise-dataops-platform-ui` conserva la documentación canónica del producto.
2. Los repositorios backend contienen implementación ejecutable, pero no sustituyen esta documentación.
3. Ningún endpoint se considera aprobado sin método, ruta, DTO, evidencia y backend propietario.
4. No se simulan en frontend capacidades inexistentes en backend.
5. Las decisiones relevantes se formalizan mediante ADR o especificación versionada.

## Documentos canónicos

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
├── architecture/
│   ├── README.md
│   ├── adr-*.md
│   ├── api-contracts/
│   ├── implementation-plans/
│   └── sprint-evidence/
├── functional/
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

- código afectado;
- documento canónico correspondiente;
- criterio de aceptación;
- evidencia de validación.
