# Matriz de trazabilidad y baseline de código

**Fecha de auditoría:** 2026-08-24  
**Objetivo:** identificar dónde está versionada cada capacidad y qué falta consolidar.  
**Frontend actual de referencia:** [Enterprise DataOps Platform — Cloud Run](https://enterprise-dataops-platform-ui-mkqutd4koq-uc.a.run.app)

> La URL anterior queda registrada como endpoint funcional actual de referencia. Esta auditoría todavía no certifica qué SHA/image digest exacto corresponde a la revisión Cloud Run actualmente servida.

## 1. Repositorio `enterprise-dataops-platform-ui`

### Runtime actual de referencia

Frontend desplegado utilizado para validar visualmente los journeys:

`https://enterprise-dataops-platform-ui-mkqutd4koq-uc.a.run.app`

Estado de trazabilidad del runtime: `TO_VALIDATE` para relación exacta `Cloud Run revision/image digest ↔ frontend Git SHA`.

### `main`

Baseline observado: `af2d36e9218b3c07fc15b504f597714c070a77b2`.

Contiene aplicación Spring Boot ejecutable y módulos de:

- profiling;
- quality rules;
- quality execution;
- reconciliation;
- navigation/dashboard/shared client.

La configuración `application.yml` utiliza `DATAOPS_API_URL` y mantiene como default una URL del servicio `jarvis-reconciliation-agent`.

### `architecture/backend-routing-matrix`

Estado respecto de `main`: **20 commits ahead, 0 behind** al momento de la auditoría.

Contiene, además del baseline de `main`:

- documentación de arquitectura;
- contratos OpenAPI Quality/Reconciliation;
- inventario y matrices de endpoints;
- scripts de certificación/smoke;
- adapters `QualityConfigurationClient` y `ReconciliationConfigurationClient`;
- experiencia V2 de profiling;
- experiencia V2 de quality rules;
- wizard V2 de reconciliation.

Conclusión: el trabajo V2 y documental está versionado, pero **no está consolidado en `main`**.

## 2. Backend `JuliusCordova/intercorp-fest-agent`

Repositorio identificado en la evidencia Sprint E como backend Jarvis para Quality/Reconciliation.

### `feature/data-quality-engine`

Estado respecto de `main`: **6 commits ahead, 0 behind** al momento de la auditoría.

Capacidades encontradas:

#### Perfilamiento

Archivo:

`modules/data_quality/profiling.py`

Implementa actualmente:

- schema de BigQuery;
- selección de columnas;
- row count;
- null count/percentage;
- distinct count/percentage;
- min/max/avg/stddev para numéricos.

Brecha: no recibe filtro temporal/histórico en `profile_table`.

#### Data Quality lifecycle

Archivos principales:

- `modules/data_quality/router.py`
- `modules/data_quality/models.py`
- `modules/data_quality/canonical_models.py`
- `modules/data_quality/canonical_repository.py`
- `modules/data_quality/canonical_router.py`
- `modules/data_quality/canonical_versioning.py`
- `modules/data_quality/execution.py`
- `modules/data_quality/execution_repository.py`

Existe:

- profile;
- draft/update/validate/confirm legacy;
- CRUD canónico;
- versionado/publicación;
- ejecución on-demand;
- result/latest.

El request de ejecución contiene `execution_mode`, con default `ON_DEMAND`.

Brecha: no se encontró implementación de scheduler persistente.

#### Reconciliation lifecycle canónico

Archivos principales:

- `modules/reconciliation_canonical/models.py`
- `modules/reconciliation_canonical/repository.py`
- `modules/reconciliation_canonical/router.py`

PR backend #10 fue fusionado a `feature/data-quality-engine` con merge commit:

`80c927df9bf8ba4faaa2b34990310e52b4fedc90`

Implementa:

- CRUD;
- validación;
- publicación;
- versiones;
- cambio de estado;
- archivado lógico;
- control optimista;
- persistencia BigQuery;
- compatibilidad camelCase/snake_case;
- pruebas contractuales.

#### Reconciliation ejecución operativa

`main.py` contiene lógica y endpoint operativo `POST /reconciliation/execute`, además del catálogo/interpretación dinámica y funciones relacionadas.

Brecha arquitectónica: el lifecycle canónico y el motor operativo deben converger explícitamente sobre el mismo `configuration_id/version_id`.

## 3. Repositorio `JuliusCordova/bussinesrulessilver`

Se encontró un backend mucho más evolucionado de **Silver Refinement**, incluyendo módulos de data quality, gobierno, AgentOps, ejecución y SPECs.

Decisión de ordenamiento:

- no copiar ese código dentro de `enterprise-dataops-platform-ui`;
- no usarlo como segundo motor paralelo de Quality/Reconciliation mientras el ownership canónico sea Jarvis;
- mantenerlo como backend/producto separado de Bronze → Silver;
- cualquier reutilización futura debe hacerse por contrato o librería explícita, no por duplicación manual.

## 4. Trazabilidad resumida

| Capacidad | UI/BFF | Backend | Estado |
|---|---|---|---|
| Frontend Cloud Run de referencia | `https://enterprise-dataops-platform-ui-mkqutd4koq-uc.a.run.app` | n/a | RUNTIME CONOCIDO / SHA TO_VALIDATE |
| Selección metadata para profiling | `enterprise-dataops-platform-ui` | Jarvis metadata | PARTIAL/TO_VALIDATE |
| Perfil actual | UI V2 + controller | `intercorp-fest-agent/modules/data_quality/profiling.py` | IMPLEMENTED |
| Perfil histórico | diseño pendiente UI | no encontrado | GAP |
| Diseño de reglas | UI V2 | data_quality service/repository | IMPLEMENTED/PARTIAL |
| CRUD/versionado Quality | adapters V2 | canonical quality modules | IMPLEMENTED branch |
| Ejecución Quality on-demand | quality execution UI/BFF | execution engine | IMPLEMENTED |
| Scheduling Quality | no encontrado | no encontrado | GAP |
| Wizard Reconciliation | UI V2 | metadata/config endpoints | IMPLEMENTED branch |
| CRUD/versionado Reconciliation | adapter V2 | reconciliation_canonical | IMPLEMENTED branch |
| Ejecución Reconciliation on-demand | reconciliation UI/BFF | `main.py` operational endpoint | IMPLEMENTED/PARTIAL convergence |
| Scheduling Reconciliation | no encontrado | no encontrado | GAP |
| Release SHA trazable extremo a extremo | parcial | parcial | PARTIAL |

## 5. Riesgos de versionado detectados

### R1 — `main` del frontend está atrasado

La rama arquitectónica concentra 20 commits no presentes en `main`. Esto crea riesgo de que el código desplegado y la fuente de verdad esperada diverjan.

### R2 — `main` del backend Jarvis está atrasado

`feature/data-quality-engine` está 6 commits adelante de `main`. Las capacidades canónicas Quality/Reconciliation no deben permanecer indefinidamente solo en una feature branch.

### R3 — Deployment no certificado contra SHA

El frontend actual está identificado en:

`https://enterprise-dataops-platform-ui-mkqutd4koq-uc.a.run.app`

Sin embargo, la URL por sí sola no prueba qué commit exacto generó la revisión actualmente servida. Debe agregarse evidencia de deployment con Cloud Run revision, commit SHA e image digest.

### R4 — Contratos legacy + canónicos coexistiendo

La coexistencia es válida durante transición, pero requiere adapters y un plan de retiro para evitar que UI, jobs y agentes usen entidades diferentes.

### R5 — Scheduling documentado pero no implementado

Los modelos y documentos mencionan modo de ejecución/frecuencia, pero no se encontró un componente scheduler persistente certificado.

### R6 — Perfil histórico no implementado

El profiler actual consulta la tabla directamente sin `business_date`, rango ni filtro temporal.

## 6. Orden de saneamiento recomendado

1. Adoptar `docs/sdd/*` como índice funcional canónico.
2. Certificar `architecture/backend-routing-matrix` y preparar su consolidación controlada hacia `main`.
3. Consolidar `feature/data-quality-engine` del backend Jarvis hacia `main` después de gates.
4. Alinear lifecycle canónico con ejecución real para Quality y Reconciliation.
5. Implementar `Historical Profiling`.
6. Implementar `Scheduling` común reutilizando los endpoints on-demand.
7. Registrar por release: frontend URL/revision + frontend SHA + backend SHA + OpenAPI + smoke + image digest.

## 7. Definition of Done de saneamiento

El ordenamiento se considera cerrado cuando:

- `main` de frontend contiene el baseline aprobado;
- `main` del backend Jarvis contiene las capacidades aprobadas;
- no existe capacidad P0 únicamente en ramas huérfanas;
- cada RF P0 apunta a código/prueba/evidencia;
- el deployment activo `https://enterprise-dataops-platform-ui-mkqutd4koq-uc.a.run.app` puede relacionarse inequívocamente con una revisión Cloud Run, image digest y SHA(s) de GitHub;
- perfil histórico y scheduling están implementados o explícitamente fuera de release, nunca ambiguos.
