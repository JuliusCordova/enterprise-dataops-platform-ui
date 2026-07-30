# Sprint C — Matriz servicio → adapter → endpoint

## Objetivo

Migrar las operaciones certificadas de los servicios BFF hacia adapters por dominio, manteniendo temporalmente en `DataOpsApiClient` únicamente capacidades que todavía no están encapsuladas por un adapter específico.

## Calidad de datos

| Servicio | Método de servicio | Adapter | Método de adapter | Endpoint certificado | Estado |
|---|---|---|---|---|---|
| `QualityRulesService` | `getRuleTypes` | `QualityConfigurationClient` | `listRuleTypes` | `GET /data-quality/rule-types` | Migrado |
| `QualityRulesService` | `createDraft` | `QualityConfigurationClient` | `createDraft` | `POST /data-quality/configure/draft` | Migrado |
| `QualityRulesService` | `getDraft` | `QualityConfigurationClient` | `getDraft` | `GET /data-quality/configure/draft/{id}` | Migrado |
| `QualityRulesService` | `updateDraft` | `QualityConfigurationClient` | `updateDraft` | `PUT /data-quality/configure/draft/{id}` | Migrado |
| `QualityRulesService` | `validateDraft` | `QualityConfigurationClient` | `validateDraft` | `POST /data-quality/configure/validate/{id}` | Migrado |
| `QualityRulesService` | `confirmDraft` | `QualityConfigurationClient` | `publishDraft` | `POST /data-quality/configure/confirm/{id}` | Migrado |

Resultado: `QualityRulesService` ya no depende directamente de `DataOpsApiClient`.

## Reconciliación

| Servicio | Método de servicio | Adapter | Método de adapter | Endpoint certificado | Estado |
|---|---|---|---|---|---|
| `ReconciliationService` | `getConfigurations` | `ReconciliationConfigurationClient` | `listConfigurations` | `GET /reconciliation/configs` | Migrado |
| `ReconciliationService` | `execute` | `ReconciliationConfigurationClient` | `execute` | `POST /reconciliation/execute` | Migrado |
| `ReconciliationService` | `getResult` | `ReconciliationConfigurationClient` | `getResult` | `GET /reconciliation/result/{executionId}` | Migrado |
| `ReconciliationService` | `createDraft` | `ReconciliationConfigurationClient` | `createDraft` | `POST /reconciliation/configure/draft` | Migrado |
| `ReconciliationService` | `getDraft` | `ReconciliationConfigurationClient` | `getDraft` | `GET /reconciliation/configure/draft/{id}` | Migrado |
| `ReconciliationService` | `updateDraft` | `ReconciliationConfigurationClient` | `updateDraft` | `PUT /reconciliation/configure/draft/{id}` | Migrado |
| `ReconciliationService` | `validateDraft` | `ReconciliationConfigurationClient` | `validateDraft` | `POST /reconciliation/configure/validate/{id}` | Migrado |
| `ReconciliationService` | `confirmDraft` | `ReconciliationConfigurationClient` | `publishDraft` | `POST /reconciliation/configure/confirm/{id}` | Migrado |

## Operaciones aún directas

Las siguientes operaciones permanecen temporalmente en `ReconciliationService` mediante `DataOpsApiClient` porque el adapter actual no las encapsula todavía:

- `GET /reconciliation/latest/{reconciliationId}`
- `POST /reconciliation/ask`
- `GET /connections`
- `GET /metadata/{connectionId}/datasets`
- `GET /metadata/{connectionId}/{datasetId}/tables`
- `GET /metadata/{connectionId}/{datasetId}/{tableId}/columns`

Estas operaciones no deben duplicarse en nuevos servicios. La siguiente evolución será crear adapters separados para metadata y consultas analíticas, en lugar de ampliar indiscriminadamente `ReconciliationConfigurationClient`.

## Reglas aplicadas

1. Solo se migran endpoints certificados.
2. No se simulan operaciones CRUD ausentes.
3. Los DTOs públicos de los servicios se conservan para no romper controladores.
4. La validación de identificadores se centraliza en los adapters para operaciones migradas.
5. Metadata y consultas analíticas deben evolucionar hacia bounded contexts propios.

## Gate de validación

- `mvn clean test`
- `mvn package -DskipTests`
- `scripts/smoke/smoke_v2_experiences.sh`
- Confirmar que `QualityRulesService` no importe `DataOpsApiClient`.
- Confirmar que las rutas de configuración de reconciliación no se construyan directamente en `ReconciliationService`.
