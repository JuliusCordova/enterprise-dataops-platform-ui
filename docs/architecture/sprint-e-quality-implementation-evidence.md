# Sprint E — Evidencia de implementación backend

## Estado

Los backends canónicos de configuraciones de calidad y reconciliación fueron implementados y validados en `JuliusCordova/intercorp-fest-agent`, rama base `feature/data-quality-engine`.

Commits integrados o preparados para integración:

- E1 calidad CRUD base: `b97f6c51acd9084dbe798a07dc1006788e4b31ba`
- E2 calidad ciclo de vida: `b5e9d25fc1d49ff3cfe6d69712462429cd3cb6d7`
- E3 calidad versionado explícito y gate OpenAPI 3.1: `5b361ec06c26bfefced2d112389453d91635e148`
- E4 reconciliación CRUD, ciclo de vida y compatibilidad dual: `4854e77fbc65c4ac66136a73e6dec4a4908db895`

Pull requests backend:

- `intercorp-fest-agent#7` — CRUD canónico base de calidad
- `intercorp-fest-agent#8` — ciclo de vida canónico de calidad
- `intercorp-fest-agent#9` — creación explícita de versiones y gate OpenAPI 3.1 de calidad
- `intercorp-fest-agent#10` — CRUD, ciclo de vida y compatibilidad dual de reconciliación

## Calidad — endpoints implementados y validados

| Método | Endpoint | Estado | Evidencia |
|---|---|---|---|
| POST | `/data-quality/configurations` | Implementado | HTTP 201 |
| GET | `/data-quality/configurations` | Implementado | HTTP 200 |
| GET | `/data-quality/configurations/{configuration_id}` | Implementado | HTTP 200 |
| PUT | `/data-quality/configurations/{configuration_id}` | Implementado | HTTP 200; conflicto optimista HTTP 409 |
| GET | `/data-quality/configurations/{configuration_id}/versions` | Implementado | HTTP 200; historial verificado |
| POST | `/data-quality/configurations/{configuration_id}/versions` | Implementado | HTTP 201; nueva versión `DRAFT`; `row_version` incremental |
| POST | `/data-quality/configurations/{configuration_id}/publish` | Implementado | HTTP 200; `ACTIVE`, `PUBLISHED` |
| PATCH | `/data-quality/configurations/{configuration_id}/status` | Implementado | `ACTIVE → INACTIVE → ACTIVE`, HTTP 200 |
| DELETE | `/data-quality/configurations/{configuration_id}` | Implementado | HTTP 204; archivado lógico |

## Reconciliación — endpoints implementados y validados

| Método | Endpoint | Estado | Evidencia |
|---|---|---|---|
| POST | `/reconciliation/configurations` | Implementado | HTTP 201 |
| GET | `/reconciliation/configurations` | Implementado | superficie OpenAPI verificada |
| GET | `/reconciliation/configurations/{configuration_id}` | Implementado | HTTP 200 |
| PUT | `/reconciliation/configurations/{configuration_id}` | Implementado | contrato y control optimista verificados |
| GET | `/reconciliation/configurations/{configuration_id}/versions` | Implementado | HTTP 200; historial verificado |
| POST | `/reconciliation/configurations/{configuration_id}/versions` | Implementado | HTTP 201 definido; body obligatorio |
| POST | `/reconciliation/configurations/{configuration_id}/validate` | Implementado | HTTP 200; `VALID` |
| POST | `/reconciliation/configurations/{configuration_id}/publish` | Implementado | HTTP 200; `ACTIVE`, `PUBLISHED` |
| PATCH | `/reconciliation/configurations/{configuration_id}/status` | Implementado | HTTP 200; conflicto optimista HTTP 409 |
| DELETE | `/reconciliation/configurations/{configuration_id}` | Implementado | HTTP 204; archivado lógico |

## Persistencia

Tablas desplegadas en `proyectopersonal-480420.dataops_control`.

Calidad:

- `quality_configuration`
- `quality_configuration_version`
- `quality_configuration_audit_event`

Reconciliación:

- `reconciliation_configuration`
- `reconciliation_configuration_version`
- `reconciliation_configuration_audit_event`

Capacidades verificadas:

- identidad estable de configuración;
- versionado incremental;
- creación explícita de nuevas versiones `DRAFT`;
- clonación o reemplazo de payload;
- validación previa a publicación en reconciliación;
- control optimista mediante `rowVersion` y `expected_row_version`;
- publicación transaccional;
- reemplazo de versiones publicadas por `SUPERSEDED`;
- auditoría de creación, actualización, creación de versión, validación, publicación, cambio de estado y archivado;
- soft delete con conservación de historial.

## Evidencia de pruebas

Calidad E3:

- `python -m compileall`: PASS
- `python -m unittest discover`: 8/8 PASS
- `git diff --check`: PASS
- gate automatizado de superficie OpenAPI 3.1: PASS
- smoke local end-to-end con Uvicorn y BigQuery: PASS

Reconciliación E4:

- `python -m compileall`: PASS
- `python -m unittest discover`: 14/14 PASS
- `git diff --check`: PASS
- worktree limpio
- OpenAPI 3.1 y superficie completa: PASS
- payload camelCase canónico: PASS
- payload snake_case legacy: PASS
- smoke local end-to-end con Uvicorn y BigQuery: PASS

## Secuencias validadas

### Calidad E3

1. creación de configuración: HTTP 201, versión 1, `row_version=1`;
2. creación explícita de versión: HTTP 201, versión 2 `DRAFT`, `row_version=2`;
3. repetición con `expected_row_version=1`: HTTP 409 `ROW_VERSION_CONFLICT`;
4. consulta de historial: HTTP 200, 2 versiones retornadas.

Configuración de smoke: `QCFG_C952A412897B4855A4A7FE1452654F12`.

### Reconciliación E4

1. creación de configuración: HTTP 201, versión 1 `DRAFT`, `row_version=1`;
2. validación: HTTP 200, `version_status=VALID`;
3. publicación: HTTP 200, `status=ACTIVE`, `version_status=PUBLISHED`, `row_version=2`;
4. consulta de versiones: HTTP 200, 1 versión publicada;
5. cambio de estado a `INACTIVE`: HTTP 200, `row_version=3`;
6. repetición con `expected_row_version=2`: HTTP 409 `ROW_VERSION_CONFLICT`;
7. archivado lógico: HTTP 204;
8. consulta final: HTTP 200, `status=ARCHIVED`, `archived_flag=true`, `row_version=4`.

Configuración de smoke: `RCFG_6E5F7F1809DE4D059EA1C78EE300B67D`.

## Estado del contrato

La superficie canónica de calidad cuenta con implementación ejecutable y gate automatizado OpenAPI 3.1.

La superficie canónica de reconciliación cuenta con implementación ejecutable, validación, publicación, versionado, auditoría, control optimista y compatibilidad dual:

- camelCase para el contrato canónico;
- snake_case para compatibilidad legacy.

El OpenAPI de este repositorio permanece como referencia canónica documental.

## Pendientes del Sprint E

- fusionar `intercorp-fest-agent#10` únicamente con autorización explícita;
- certificar OpenAPI de calidad y reconciliación contra Cloud Run;
- decidir el tratamiento de drafts anteriores después de publicación;
- certificar adaptadores legacy de extremo a extremo desde frontend/BFF;
- actualizar la matriz canónica endpoint ↔ legacy con evidencia remota.

## Decisión

Los frentes de calidad y reconciliación del Sprint E se consideran implementados y validados localmente contra BigQuery.

El Sprint E permanece abierto para integración del PR de reconciliación, certificación remota en Cloud Run y cierre documental final.