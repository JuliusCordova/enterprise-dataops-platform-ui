# Frontend Silver E2E Intelligent Mapping PASS — 2026-08-07

## Purpose

Persist the verified end-to-end Intelligent Mapping validation performed through the local unified frontend and BFF against the existing production Silver backend. This checkpoint must be reused as the source of truth for the next Silver UI step and avoids repeating the same discovery or validation from chat history.

## Frontend branch baseline

Repository:

`JuliusCordova/enterprise-dataops-platform-ui`

Branch:

`feature/unified-frontend-silver-integration`

Baseline commit before this checkpoint:

`97d07211552743ea631fd3d7f9ac9742c2eda288`

Previous checkpoint:

`docs/checkpoints/2026-08-07-frontend-silver-execution-observability-pass.md`

## E2E validation topology

Validated path:

`Local browser/frontend -> Spring Boot BFF -> production Silver backend`

Local frontend URL used:

`http://127.0.0.1:18084`

Production Silver backend remained unchanged during the test.

## Read-only frontend/BFF smoke already passed

Before the Intelligent Mapping test, the following checks returned HTTP 200:

- production Silver `/health`;
- local Spring Boot `/actuator/health`;
- local Thymeleaf `/silver-refinement/new`;
- local BFF `GET /ui/api/silver/workflows`.

The rendered page contained the expected product text including:

- `Nuevo flujo Silver`;
- `Recomendar mapping`;
- `Valida, ejecuta y observa el pipeline`.

The BFF returned real workflow data from the production Silver backend.

## E2E Intelligent Mapping test case

Source dataset:

`seguros_bronce`

Source table:

`cat_producto`

Logical target project:

`proyectopersonal-480420`

Logical target dataset:

`seguros_silver`

Logical target table:

`cat_producto`

The physical target table did not need to exist for the mapping recommendation request and was not created by this validation.

## Reused workflow

Two confirmed workflows for `seguros_bronce.cat_producto` were found.

Selected workflow:

`workflow_d742f090881e47b9b1be2ea1fbb612b7`

Selected workflow version:

`7`

Workflow state during validation:

- status: `IN_PROGRESS`;
- active step: `6`;
- confirmed schema columns: `12`.

## Target dataset validation

The BFF destination catalog returned HTTP 200.

Dataset:

`seguros_silver`

was found successfully.

Observed properties:

- location: `US`;
- table count at validation time: `3`.

No dataset or table creation operation was executed.

## Mapping recommendation result

Request path through the local BFF:

`POST /ui/api/silver/workflows/{workflowId}/mapping-recommendations`

Result:

`HTTP 200`

Recommendation engine:

`deterministic-v1`

Human approval required at response level:

`true`

## Recommended incremental strategy

The production backend returned:

- strategy: `INCREMENTAL_WATERMARK`;
- watermark column: `bronze_fecha_ingesta`;
- tie breaker: `producto_id`;
- business keys: `[producto_id]`;
- lookback: `1 DAY`;
- late-arrival policy: `REPROCESS_LOOKBACK_WINDOW`.

This proves the production backend recognizes the Bronze ingestion timestamp as the incremental control field for this source.

## Recommended physical design

The production backend returned:

- partitioning enabled: `true`;
- partition column: `bronze_fecha_ingesta`;
- partition granularity: `DAY`;
- clustering columns:
  - `producto_id`;
  - `ramo_id`;
  - `bronze_registro_id`;
  - `bronze_carga_id`.

## Recommended mappings

Twelve columns were returned.

Key examples:

- `producto_id -> producto_id`: `TRIM`, confidence `0.96`, no manual approval required;
- `ramo_id -> ramo_id`: `TRIM`, confidence `0.96`, no manual approval required;
- `prima_base -> prima_base`: `DIRECT`, confidence `0.99`;
- `bronze_fecha_ingesta -> bronze_fecha_ingesta`: `DIRECT`, confidence `0.99`;
- `bronze_estado_registro -> bronze_estado_registro`: `UPPER`, confidence `0.84`, manual approval required.

The risk returned for `bronze_estado_registro` was that case normalization can alter values that are sensitive to uppercase/lowercase semantics.

This proves the confidence/risk/approval concepts already exposed in the frontend are backed by real production recommendation data.

## Side-effect guardrails observed

This E2E validation did not:

- create the physical Silver target table;
- save a Silver specification;
- generate artifacts;
- create an execution;
- modify Silver backend code;
- modify Cloud Run;
- modify production traffic.

The mapping recommendation call is treated as a recommendation operation, not as a workflow specification persistence operation.

## Product gap discovered by E2E

The test exposed a genuine frontend product gap.

The current Step 4 target-table control is populated only from existing BigQuery tables in the selected Silver dataset. Therefore, a new Bronze-to-Silver flow cannot naturally choose a logical target table that does not exist yet.

This conflicts with the intended product journey because the frontend itself later generates the governed Silver DDL/package that can define the new target table.

The production mapping recommendation backend does not require the target table to pre-exist; it accepts the target table identifier as logical design context.

## Next implementation slice

The next frontend slice should support both target modes:

1. `Tabla existente` — select a table already present in the destination dataset;
2. `Nueva tabla Silver` — enter a valid logical target table name even when the table does not yet exist.

The target table value must then be used consistently by:

- target summary;
- location compatibility logic where applicable;
- mapping recommendation request;
- specification save request;
- artifact generation request.

Creating a new logical target name in the UI must not itself create a physical BigQuery table. Physical creation remains governed by the generated DDL/execution path.

## Reuse rule

Do not repeat this E2E Intelligent Mapping validation unless one of these changes materially:

- frontend target-selection implementation;
- mapping recommendation contract;
- destination catalog behavior;
- production Silver backend contract;
- the user explicitly requests a fresh validation.

This checkpoint is the canonical PASS record for the frontend/BFF production Intelligent Mapping E2E validation.
