# ADR-001 — Frontend único, backends separados y CRUD gobernado

- **Estado:** Propuesto para aprobación
- **Fecha:** 2026-07-29
- **Repositorio dueño:** `JuliusCordova/enterprise-dataops-platform-ui`
- **Branch:** `architecture/backend-routing-matrix`
- **Relacionado con:**
  - `docs/architecture/backend-routing-matrix.md`
  - `docs/architecture/crud-quality-reconciliation-spec.md`

## 1. Contexto

La plataforma Enterprise DataOps evolucionó con un frontend modular en Spring Boot/Thymeleaf y dos dominios backend distintos:

1. `jarvis-reconciliation-agent`, responsable de profiling, calidad y reconciliación.
2. `silver-refinement-agent`, responsable del flujo Bronze→Silver, reglas de refinamiento, ejecución Silver, gobierno y AgentOps.

El inventario del frontend confirmó que los módulos de profiling, quality rules, quality execution y reconciliation no son solo maquetas: existen controladores Spring, servicios BFF, DTOs y llamadas reales a rutas internas `/ui/api/**`. Actualmente todos consumen una sola propiedad `DATAOPS_API_URL`, cuyo valor por defecto apunta a `jarvis-reconciliation-agent`.

También se detectaron riesgos críticos:

- convivencia de contratos V1/V2;
- fallback local que puede aparentar éxito cuando el backend falla;
- ausencia de integración Silver en el frontend oficial;
- CRUD incompleto para configuraciones publicadas de calidad y reconciliación;
- inexistencia de versionado explícito, activación/desactivación, archivado lógico e historial completo;
- riesgo de mezclar reglas de calidad con reglas de refinamiento Silver.

## 2. Decisión

### 2.1 Frontend único

`enterprise-dataops-platform-ui` será la única experiencia web oficial de la plataforma.

El frontend:

- presenta información;
- valida formularios de forma básica;
- orquesta navegación y experiencia;
- expone rutas BFF `/ui/api/**`;
- adapta contratos entre UI y backend cuando sea necesario.

El frontend no:

- calcula perfiles;
- ejecuta reglas de calidad;
- reconcilia datos;
- persiste configuraciones como fuente de verdad;
- implementa lógica de refinamiento Silver;
- genera identificadores locales que aparenten persistencia remota.

### 2.2 Backends separados por bounded context

| Bounded context | Backend dueño |
|---|---|
| Profiling | `jarvis-reconciliation-agent` |
| Quality Rules | `jarvis-reconciliation-agent` |
| Quality Execution | `jarvis-reconciliation-agent` |
| Reconciliation | `jarvis-reconciliation-agent` |
| Silver Workflow | `silver-refinement-agent` |
| Silver Business Rules / Mapping | `silver-refinement-agent` |
| Silver Execution | `silver-refinement-agent` |
| Silver Governance | `silver-refinement-agent` |
| Silver AgentOps | `silver-refinement-agent` |

No se permite duplicar una capacidad en ambos backends sin ADR nuevo y aprobación explícita.

### 2.3 Configuración separada por backend

La configuración objetivo será:

```yaml
backends:
  reconciliation:
    base-url: ${RECONCILIATION_BACKEND_BASE_URL}
  silver:
    base-url: ${SILVER_BACKEND_BASE_URL}
```

Se eliminará gradualmente la dependencia de una única propiedad genérica `DATAOPS_API_URL`.

### 2.4 Clientes separados en el frontend

La estructura objetivo será:

```text
src/main/java/com/kyndryl/dataops/platform/integration/
├── reconciliation/
│   ├── ProfilingClient
│   ├── QualityRulesClient
│   ├── QualityExecutionClient
│   ├── ReconciliationClient
│   └── dto/
└── silver/
    ├── SilverWorkflowClient
    ├── SilverExecutionClient
    ├── SilverGovernanceClient
    ├── SilverAgentOpsClient
    └── dto/
```

Cada cliente debe tener:

- timeout explícito;
- manejo de errores normalizado;
- trazabilidad de request/correlation ID;
- DTOs propios del bounded context;
- pruebas de contrato;
- configuración por ambiente.

## 3. Decisión CRUD

Las configuraciones de calidad y reconciliación serán recursos gobernados, versionados y auditables.

### 3.1 Ciclo de vida

Estados canónicos:

```text
DRAFT → VALIDATED → ACTIVE → INACTIVE → ARCHIVED
```

Reglas:

1. Solo `DRAFT` puede editarse directamente.
2. Editar una versión `ACTIVE` crea una nueva versión `DRAFT`.
3. Publicar una nueva versión activa no elimina la anterior.
4. La versión anterior queda disponible para historial y auditoría.
5. `DELETE` será archivado lógico.
6. Una configuración usada en ejecuciones nunca se elimina físicamente.
7. Toda transición debe registrar actor, fecha, versión, motivo y correlation ID.

### 3.2 CRUD de calidad de datos

Contrato objetivo:

```text
POST   /data-quality/configurations
GET    /data-quality/configurations
GET    /data-quality/configurations/{id}
PUT    /data-quality/configurations/{id}
POST   /data-quality/configurations/{id}/validate
POST   /data-quality/configurations/{id}/publish
POST   /data-quality/configurations/{id}/versions
PATCH  /data-quality/configurations/{id}/status
DELETE /data-quality/configurations/{id}
GET    /data-quality/configurations/{id}/versions
```

Capacidades mínimas de UI:

- catálogo paginado;
- filtros por estado, dominio, owner, dataset y tabla;
- creación guiada;
- consulta de detalle;
- edición de draft;
- creación de nueva versión desde activa;
- validación previa a publicación;
- activación/desactivación;
- archivado lógico;
- historial de versiones;
- consulta de ejecuciones relacionadas.

### 3.3 CRUD de reconciliación

Contrato objetivo:

```text
POST   /reconciliation/configurations
GET    /reconciliation/configurations
GET    /reconciliation/configurations/{id}
PUT    /reconciliation/configurations/{id}
POST   /reconciliation/configurations/{id}/validate
POST   /reconciliation/configurations/{id}/publish
POST   /reconciliation/configurations/{id}/versions
PATCH  /reconciliation/configurations/{id}/status
DELETE /reconciliation/configurations/{id}
GET    /reconciliation/configurations/{id}/versions
```

Capacidades mínimas de UI:

- catálogo de conciliaciones;
- creación guiada origen-destino;
- definición de llaves y métricas;
- consulta de detalle;
- edición de draft;
- nueva versión desde configuración activa;
- validación técnica y funcional;
- activación/desactivación;
- archivado lógico;
- historial de versiones;
- consulta de ejecuciones, diferencias y evidencias.

## 4. Hallazgos técnicos confirmados

### 4.1 Integración BFF real

Los módulos actuales exponen rutas internas `/ui/api/**` y delegan a servicios Java.

Ejemplos confirmados:

```text
/ui/api/profiling/**
/ui/api/quality-rules/**
/ui/api/quality-execution/**
/ui/api/reconciliation/**
```

### 4.2 Calidad tiene CRUD parcial de drafts

El frontend ya consume operaciones remotas para:

- crear draft;
- consultar draft;
- actualizar draft;
- validar;
- confirmar/publicar.

Faltan contratos de recurso publicado, versionado, estado, archivado e historial.

### 4.3 Reconciliación tiene mayor cobertura funcional

El frontend ya consume operaciones para:

- listar configuraciones;
- ejecutar;
- consultar resultado;
- consultar última ejecución;
- preguntar al asistente;
- crear draft;
- consultar draft;
- actualizar draft;
- validar;
- confirmar/publicar.

Faltan edición gobernada de configuraciones activas, nueva versión, activación/desactivación, archivado lógico e historial.

### 4.4 Fallback local peligroso

La experiencia V2 de Quality Rules puede:

- generar recomendaciones locales;
- crear identificadores `LOCAL_*`;
- continuar el flujo visual sin persistencia backend.

Decisión: todo fallback debe mostrarse como **modo degradado no persistente**. No podrá habilitar publicación, activación ni confirmación exitosa.

### 4.5 Contratos V1/V2 coexistentes

Existen rutas alternativas para metadata y profiling. Debe establecerse una versión canónica antes de continuar desarrollando pantallas.

### 4.6 Silver todavía no está integrado al frontend oficial

No se identificó cliente BFF ni configuración separada para `silver-refinement-agent`. Esa integración deberá entrar en un slice independiente después de estabilizar los contratos de calidad/reconciliación.

## 5. Consecuencias

### Positivas

- ownership claro;
- trazabilidad completa;
- CRUD empresarial consistente;
- menor riesgo de duplicidad;
- evolución independiente de backends;
- auditoría y rollback por versión;
- contract tests por bounded context.

### Costos y compromisos

- refactor de configuración;
- separación de clientes y DTOs;
- construcción de endpoints faltantes;
- migración de rutas V1/V2;
- eliminación de falsos éxitos locales;
- desarrollo de catálogo e historial;
- pruebas de contrato y smoke end-to-end.

## 6. Gate de avance

No se desarrollarán nuevas integraciones de negocio hasta completar:

1. extracción del OpenAPI real de `jarvis-reconciliation-agent`;
2. comparación frontend esperado vs backend existente;
3. clasificación de endpoints: existente, incompatible, faltante o deprecated;
4. definición final del contrato CRUD;
5. eliminación o bloqueo de fallbacks que aparenten persistencia;
6. prueba smoke por cada módulo;
7. aprobación de esta ADR.

## 7. Plan recomendado

### P0 — Certificación de contratos

- obtener OpenAPI productivo;
- inventariar rutas reales;
- generar matriz endpoint por endpoint;
- validar autenticación y errores;
- confirmar owner del backend.

### P1 — CRUD gobernado

- completar recursos publicados;
- versionado;
- estados;
- archivado lógico;
- historial;
- auditoría.

### P2 — Refactor frontend

- separar clientes reconciliation/silver;
- separar configuración;
- normalizar DTOs;
- remover rutas V1 obsoletas;
- endurecer modo degradado.

### P3 — Integración Silver

- integrar Silver Workflow;
- integrar ejecución;
- integrar governance;
- integrar AgentOps.

## 8. Criterios de aceptación

La arquitectura se considera estabilizada cuando:

- cada módulo tiene un único backend dueño;
- cada endpoint está respaldado por OpenAPI y smoke test;
- calidad y reconciliación tienen CRUD gobernado completo;
- no existe publicación simulada local;
- las versiones activas son inmutables;
- el historial puede reconstruir cualquier ejecución;
- los clientes frontend están separados por bounded context;
- las URLs se configuran por ambiente.
