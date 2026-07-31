# Sprint E — Evidencia de implementación backend de calidad

## Estado

El backend canónico de configuraciones de calidad fue implementado y validado en `JuliusCordova/intercorp-fest-agent`, rama base `feature/data-quality-engine`.

Commits integrados:

- E1 CRUD base: `b97f6c51acd9084dbe798a07dc1006788e4b31ba`
- E2 ciclo de vida: `b5e9d25fc1d49ff3cfe6d69712462429cd3cb6d7`
- E3 versionado explícito y gate OpenAPI 3.1: `5b361ec06c26bfefced2d112389453d91635e148`

Pull requests backend:

- `intercorp-fest-agent#7` — CRUD canónico base
- `intercorp-fest-agent#8` — ciclo de vida canónico
- `intercorp-fest-agent#9` — creación explícita de versiones y gate OpenAPI 3.1

## Endpoints implementados y validados

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

## Persistencia

Tablas desplegadas en `proyectopersonal-480420.dataops_control`:

- `quality_configuration`
- `quality_configuration_version`
- `quality_configuration_audit_event`

Capacidades verificadas:

- identidad estable de configuración;
- versionado incremental;
- creación explícita de nuevas versiones `DRAFT`;
- clonación del payload actual cuando no se suministra uno nuevo;
- reemplazo explícito del payload cuando se suministra;
- control optimista mediante `expected_row_version`;
- publicación transaccional;
- auditoría de creación, actualización, creación de versión, publicación, activación, desactivación y archivado;
- soft delete con conservación de historial.

## Evidencia de pruebas

- `python -m compileall`: PASS
- `python -m unittest discover`: PASS
- 8 pruebas ejecutadas correctamente en E3
- `git diff --check`: PASS
- gate automatizado de superficie OpenAPI 3.1: PASS
- smoke local end-to-end con Uvicorn y BigQuery: PASS

Secuencia E2 validada:

1. publicación: HTTP 200, `row_version=3`;
2. desactivación: HTTP 200, `row_version=4`;
3. reactivación: HTTP 200, `row_version=5`;
4. consulta de versiones: HTTP 200;
5. archivado lógico: HTTP 204;
6. consulta final: HTTP 200, `status=ARCHIVED`, `archived_flag=true`, `row_version=6`.

Secuencia E3 validada:

1. creación de configuración: HTTP 201, versión 1, `row_version=1`;
2. creación explícita de versión: HTTP 201, versión 2 `DRAFT`, `row_version=2`;
3. repetición con `expected_row_version=1`: HTTP 409 `ROW_VERSION_CONFLICT`;
4. consulta de historial: HTTP 200, 2 versiones retornadas.

Configuración de smoke E3:

`QCFG_C952A412897B4855A4A7FE1452654F12`

## Estado del contrato

La superficie canónica de calidad ya cuenta con implementación ejecutable y un gate automatizado que verifica OpenAPI `3.1.0`, métodos HTTP esperados y el contrato mínimo de `POST /configurations/{configuration_id}/versions`.

El OpenAPI de este repositorio permanece como referencia canónica documental. La certificación contra un despliegue productivo remoto y la compatibilidad legacy continúan pendientes.

## Pendientes del Sprint E

- definir tratamiento canónico de drafts anteriores después de publicación;
- certificar OpenAPI contra el backend desplegado en Cloud Run;
- implementar CRUD y ciclo de vida canónico de reconciliación;
- documentar y certificar adaptadores de compatibilidad legacy.

## Decisión

El frente de calidad del Sprint E —CRUD, ciclo de vida, versionado explícito, auditoría, control optimista y gate OpenAPI 3.1— se considera cerrado y validado.

El Sprint E permanece abierto para reconciliación canónica, certificación remota y compatibilidad legacy.
