# Inventario de código desarrollado y por desarrollar

> Repositorio canónico: `JuliusCordova/enterprise-dataops-platform-ui`  
> Branch de trabajo: `architecture/backend-routing-matrix`  
> Alcance: frontend/BFF de profiling, calidad de datos y reconciliación

## 1. Objetivo

Mantener en un solo lugar la relación entre:

- código ya desarrollado y versionado;
- código detectado localmente pero todavía no consolidado;
- código nuevo incorporado como base arquitectónica;
- código pendiente para completar el CRUD empresarial;
- dependencias que pertenecen al backend `jarvis-reconciliation-agent`.

Este inventario evita duplicar lógica, confundir código local con código oficial o construir pantallas sobre contratos inexistentes.

## 2. Código desarrollado y versionado

### 2.1 Integración existente del frontend

El frontend ya contiene módulos reales para:

- `profiling`;
- `qualityrules`;
- `qualityexecution`;
- `reconciliation`.

Los módulos actuales usan `DataOpsApiClient` como cliente HTTP común y consumen el backend configurado mediante `dataops.api.base-url`.

### 2.2 Contratos backend certificados

El OpenAPI productivo de `jarvis-reconciliation-agent` confirmó 36 operaciones. Para los dominios relevantes se verificaron:

#### Profiling y metadatos

```text
GET  /connections
GET  /metadata/{connection_id}/datasets
GET  /metadata/{connection_id}/{dataset_id}/tables
GET  /metadata/{connection_id}/{dataset_id}/{table_id}/columns
POST /data-quality/profile
```

#### Calidad de datos

```text
GET  /data-quality/rule-types
POST /data-quality/configure/draft
GET  /data-quality/configure/draft/{draft_id}
PUT  /data-quality/configure/draft/{draft_id}
POST /data-quality/configure/validate/{draft_id}
POST /data-quality/configure/confirm/{draft_id}
GET  /data-quality/configs
GET  /data-quality/config/{quality_config_id}
POST /data-quality/execute
GET  /data-quality/result/{execution_id}
GET  /data-quality/issues/{execution_id}
GET  /data-quality/latest/{quality_config_id}
```

#### Reconciliación

```text
GET  /reconciliation/configs
POST /reconciliation/configure/draft
GET  /reconciliation/configure/draft/{draft_id}
PUT  /reconciliation/configure/draft/{draft_id}
POST /reconciliation/configure/validate/{draft_id}
POST /reconciliation/configure/confirm/{draft_id}
POST /reconciliation/execute
GET  /reconciliation/result/{execution_id}
GET  /reconciliation/latest/{reconciliation_id}
POST /reconciliation/ask
```

## 3. Código nuevo incorporado en este sprint

Se añadieron adapters explícitos por bounded context:

```text
src/main/java/com/kyndryl/dataops/platform/integration/quality/
└── QualityConfigurationClient.java

src/main/java/com/kyndryl/dataops/platform/integration/reconciliation/
└── ReconciliationConfigurationClient.java
```

Estos adapters:

- encapsulan rutas reales certificadas;
- evitan propagar paths legacy por controladores y servicios;
- no simulan operaciones que el backend todavía no expone;
- preparan la migración progresiva desde `DataOpsApiClient` genérico;
- preservan compatibilidad con el backend actual.

## 4. Código local detectado y pendiente de consolidación

En la copia local de Cloud Shell se detectaron cambios modificados y archivos no versionados, entre ellos:

```text
Dockerfile
ReconciliationDraftCreateRequest.java
ReconciliationDraftUpdateRequest.java
enterprise-theme.css
reconciliation/wizard.js
fragments/layout.html
quality-rules/index.html
reconciliation/index.html
reconciliation/new.html

ProfilingExperienceV2Controller.java
QualityRulesExperienceV2Controller.java
data-quality-experience-v2.css
reconciliation-wizard-v2.css
profiling/experience-v2.js
quality-rules/suggestions-v2.js
profiling/index-v2.html
quality-rules/index-v2.html
```

También se detectaron artefactos y respaldos locales:

```text
README_INSTALACION.md
artifacts/
backup_before_dq_v2/
backup_before_wizard_v2/
install_wizard_v2.sh
```

Regla: estos archivos no se eliminan, no se mezclan automáticamente y no se consideran parte del código oficial hasta completar inventario, revisión funcional y commit controlado.

## 5. Código por desarrollar en el frontend/BFF

### 5.1 Migración progresiva de servicios

Pendiente:

- migrar `QualityRulesService` hacia `QualityConfigurationClient`;
- migrar `ReconciliationService` hacia `ReconciliationConfigurationClient`;
- crear `QualityExecutionClient`;
- crear `ReconciliationExecutionClient`;
- crear `ProfilingClient` dedicado;
- separar DTOs por bounded context;
- eliminar dependencia directa del cliente genérico en servicios de dominio.

### 5.2 BFF CRUD de calidad

Por desarrollar cuando el backend exponga contratos completos:

```text
GET    /ui/api/data-quality/configurations
GET    /ui/api/data-quality/configurations/{id}
POST   /ui/api/data-quality/configurations
PUT    /ui/api/data-quality/configurations/{id}
POST   /ui/api/data-quality/configurations/{id}/validate
POST   /ui/api/data-quality/configurations/{id}/publish
POST   /ui/api/data-quality/configurations/{id}/versions
PATCH  /ui/api/data-quality/configurations/{id}/status
DELETE /ui/api/data-quality/configurations/{id}
GET    /ui/api/data-quality/configurations/{id}/versions
```

### 5.3 BFF CRUD de reconciliación

```text
GET    /ui/api/reconciliation/configurations
GET    /ui/api/reconciliation/configurations/{id}
POST   /ui/api/reconciliation/configurations
PUT    /ui/api/reconciliation/configurations/{id}
POST   /ui/api/reconciliation/configurations/{id}/validate
POST   /ui/api/reconciliation/configurations/{id}/publish
POST   /ui/api/reconciliation/configurations/{id}/versions
PATCH  /ui/api/reconciliation/configurations/{id}/status
DELETE /ui/api/reconciliation/configurations/{id}
GET    /ui/api/reconciliation/configurations/{id}/versions
```

### 5.4 UX pendiente

Para ambos dominios:

- catálogo con búsqueda, filtros y paginación;
- detalle de configuración;
- edición de borrador;
- nueva versión desde una configuración activa;
- activar y desactivar;
- archivado lógico;
- historial y comparación de versiones;
- badge de estado y versión;
- mensajes de persistencia reales;
- eliminación de falsos éxitos `LOCAL_*`.

## 6. Código por desarrollar en el backend

Estas capacidades pertenecen a `jarvis-reconciliation-agent`, no al frontend:

### Calidad

```text
POST   /data-quality/configurations/{id}/versions
PATCH  /data-quality/configurations/{id}/status
DELETE /data-quality/configurations/{id}
GET    /data-quality/configurations/{id}/versions
```

### Reconciliación

```text
GET    /reconciliation/configurations/{id}
POST   /reconciliation/configurations/{id}/versions
PATCH  /reconciliation/configurations/{id}/status
DELETE /reconciliation/configurations/{id}
GET    /reconciliation/configurations/{id}/versions
```

Además, el backend debe implementar:

- ciclo de vida `DRAFT → VALIDATED → ACTIVE → INACTIVE → ARCHIVED`;
- versionado inmutable;
- concurrencia optimista mediante `etag` o `expected_version`;
- auditoría completa;
- archivado lógico;
- referencia exacta de versión en cada ejecución;
- OpenAPI actualizado;
- compatibilidad temporal con rutas legacy.

## 7. Orden de implementación acordado

1. Cerrar Sprint A con matriz contractual y código inventariado.
2. Consolidar de forma segura el código local V2.
3. Implementar adapters y clientes por bounded context.
4. Implementar backend foundation: listado, detalle y creación.
5. Implementar lifecycle backend: versión, estado, archivado e historial.
6. Implementar CRUD de calidad en frontend.
7. Implementar CRUD de reconciliación en frontend.
8. Ejecutar contract tests, E2E, smoke y despliegue incremental.

## 8. Regla de gobierno del código

- GitHub es la fuente de verdad.
- Ningún archivo local no versionado se considera oficial.
- Ninguna operación backend faltante se simula como éxito.
- Las rutas legacy se encapsulan en adapters.
- Los contratos canónicos se habilitan solo con evidencia OpenAPI y smoke.
- La documentación arquitectónica y el código evolucionan en el mismo PR.
