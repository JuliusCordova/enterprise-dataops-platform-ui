# Frontend Silver Logical Target E2E PASS — 2026-08-07

## Purpose

Persist the end-to-end validation of the new logical Silver target-table behavior through the running unified frontend and BFF against the existing production Silver backend.

## Baseline

Repository: `JuliusCordova/enterprise-dataops-platform-ui`

Branch: `feature/unified-frontend-silver-integration`

Frontend baseline commit before this checkpoint:

`e6da61acd71f1829846d81488a527f46e1770272`

Functional implementation under validation:

`fc2a0021740bf57ec7a334fe8392b4dcaeda0501`

Previous checkpoint:

`docs/checkpoints/2026-08-07-frontend-silver-logical-target-tables-pass.md`

## E2E topology

Validated path:

`Running local frontend -> Spring Boot BFF -> production Silver backend`

Local frontend URL used:

`http://127.0.0.1:18084`

No deployment or production traffic change was performed.

## Test case

Source:

`proyectopersonal-480420.seguros_bronce.cat_producto`

Destination dataset:

`proyectopersonal-480420.seguros_silver`

Target mode:

`Nueva tabla Silver`

Logical target table:

`cat_producto`

## Running frontend validation

The running frontend returned HTTP 200 for:

- `/actuator/health`;
- `/silver-refinement/new`;
- `/js/silver-refinement/new.js`.

The served HTML contained:

- `sw-target-mode`;
- `sw-target-table-new`;
- `Nueva tabla Silver`.

The served JavaScript contained the expected logical-target behavior:

- `targetTableValue`;
- `validatedTargetTable`;
- `clearTargetDependentRuntime`.

This proves the local running application was serving the new logical-target implementation rather than an older build.

## Physical-target absence before recommendation

The BFF destination catalog returned HTTP 200 for `seguros_silver`.

Before the recommendation request:

- `cat_producto` did not exist physically in `seguros_silver`;
- destination table count was `3`;
- existing tables were `incwm_e2e_target`, `md_canal`, and `movimientos_siniestro`.

Validation result:

`ABSENT_BEFORE_RC=0`

## Existing workflow reused

Two confirmed workflows for `seguros_bronce.cat_producto` were found.

Selected workflow:

`workflow_d742f090881e47b9b1be2ea1fbb612b7`

Selected version:

`7`

Observed state:

- status: `IN_PROGRESS`;
- active step: `6`.

No new workflow was created for this validation.

## Logical-target mapping recommendation

Request through the BFF:

`POST /ui/api/silver/workflows/{workflowId}/mapping-recommendations`

Result:

`HTTP 200`

Logical target returned by the backend:

`proyectopersonal-480420.seguros_silver.cat_producto`

Recommendation engine:

`deterministic-v1`

Response-level human approval requirement:

`true`

## Incremental strategy returned

The production backend returned:

- strategy: `INCREMENTAL_WATERMARK`;
- watermark column: `bronze_fecha_ingesta`;
- tie breaker: `producto_id`;
- business keys: `[producto_id]`;
- lookback: `1 DAY`.

## Physical design returned

The production backend returned:

- partitioning enabled: `true`;
- partition column: `bronze_fecha_ingesta`;
- granularity: `DAY`;
- clustering columns:
  - `producto_id`;
  - `ramo_id`;
  - `bronze_registro_id`;
  - `bronze_carga_id`.

## Mapping semantics

The response contained `12` columns.

At least one recommendation required manual approval.

Semantic validation results:

- target matched requested logical target: PASS;
- strategy `INCREMENTAL_WATERMARK`: PASS;
- watermark `bronze_fecha_ingesta`: PASS;
- partitioning enabled: PASS;
- partition column `bronze_fecha_ingesta`: PASS;
- 12 columns returned: PASS;
- at least one approval-required mapping: PASS.

Overall semantic gate:

`SEMANTIC_RC=0`

## Physical-target absence after recommendation

After the recommendation request, the destination catalog was queried again.

Observed result:

- `cat_producto` still did not exist physically;
- destination table count remained `3`.

Validation result:

`ABSENT_AFTER_RC=0`

This proves that selecting/recommending a logical target does not create the physical BigQuery table.

## HTTP and gate evidence

- `LOCAL_HTTP=200`
- `PAGE_HTTP=200`
- `JS_HTTP=200`
- `TABLES_BEFORE_HTTP=200`
- `WORKFLOWS_HTTP=200`
- `RECOMMEND_HTTP=200`
- `SEMANTIC_RC=0`
- `TABLES_AFTER_HTTP=200`
- `ABSENT_AFTER_RC=0`

## Side-effect guardrails observed

This validation did not:

- save a Silver specification;
- generate artifacts;
- create an execution;
- create the physical BigQuery target table;
- modify Silver backend code;
- modify Cloud Run;
- modify production traffic.

## Product conclusion

The logical-target gap discovered in the earlier E2E has now been validated as fixed in the running product path.

The product can represent:

`seguros_bronce.cat_producto -> seguros_silver.cat_producto`

as a new logical Silver destination even when the target table does not yet exist physically, while still obtaining the real incremental mapping recommendation from the production Silver backend.

## Next gate

The next step changes backend workflow state and therefore must remain a separate explicit decision:

Persist the Silver specification/contract for the selected workflow and logical target.

That step should validate:

- persisted `silver_target` equals the current logical target;
- returned `spec_id` and mapping version;
- target-to-contract consistency guardrail;
- no physical target table creation merely from specification persistence.

Do not generate artifacts or create/submit an execution as part of the specification-persistence gate unless separately approved.

## Reuse rule

Do not repeat this logical-target E2E unless the logical-target implementation, mapping recommendation contract, destination catalog behavior, production Silver backend contract, or user-requested validation scope changes materially.
