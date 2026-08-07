# Frontend Silver Contract Persistence PASS — 2026-08-07

## Purpose

Persist the controlled end-to-end evidence for creating a fresh `cat_producto` Silver workflow, reusing the existing confirmed schema and Business Rules, obtaining the real mapping recommendation, and persisting the Silver specification for the logical target `proyectopersonal-480420.seguros_silver.cat_producto`.

## Baseline

Repository: `JuliusCordova/enterprise-dataops-platform-ui`

Branch: `feature/unified-frontend-silver-integration`

Frontend baseline before this checkpoint:

`e62f4b1f35f0bfeae4685ad27f0965918ec3a2ac`

No frontend code change was required for this gate.

## Authorization and scope

The user explicitly authorized:

- creating a new `cat_producto` workflow;
- reusing the existing `cat_producto` schema and confirmed Business Rules;
- progressing the new workflow to specification step 4;
- persisting the Silver contract toward `proyectopersonal-480420.seguros_silver.cat_producto`;
- stopping before quality review, artifact generation, execution creation, and Dataproc submission.

## Donor workflow

Donor workflow:

`workflow_d742f090881e47b9b1be2ea1fbb612b7`

Validated donor evidence:

- source: `proyectopersonal-480420.seguros_bronce.cat_producto`;
- source confirmed: true;
- schema columns: 12;
- Business Rules status: `CONFIRMED`;
- Business Rules count: 1.

The donor workflow itself was not modified by this gate.

## Physical target state before mutation

Destination dataset:

`proyectopersonal-480420.seguros_silver`

Before the controlled workflow/specification mutations:

- `cat_producto` did not exist physically;
- destination table count was 3;
- physical target absence validation passed.

## Controlled workflow creation

A new workflow was created specifically for this contract gate.

Workflow ID:

`workflow_c7ab7e9ff9614576b2f49d5d6f65ebc1`

Initial state:

- version: 1;
- status: `DRAFT`;
- active step: 1;
- Business Rules: `EMPTY`;
- `spec_id`: null;
- Silver target: null.

## Source confirmation

The donor schema was reused to confirm the new workflow source.

Result:

- HTTP 200;
- version: 2;
- status: `IN_PROGRESS`;
- active step: 3;
- schema columns: 12.

## Business Rules reuse

The confirmed donor Business Rule was reused in the new workflow.

Draft persistence result:

- HTTP 200;
- version: 3;
- active step: 3;
- Business Rules status: `DRAFT`.

Confirmation result:

- HTTP 200;
- version: 4;
- active step: 4;
- Business Rules status: `CONFIRMED`;
- `spec_id`: null.

This established the exact backend gate required for specification persistence.

## Mapping recommendation at step 4

The BFF called the production Silver backend for the logical target:

`proyectopersonal-480420.seguros_silver.cat_producto`

Recommendation result:

- HTTP 200;
- engine: `deterministic-v1`;
- strategy: `INCREMENTAL_WATERMARK`;
- watermark: `bronze_fecha_ingesta`;
- tie breaker: `producto_id`;
- business keys: `[producto_id]`;
- partition column: `bronze_fecha_ingesta`;
- recommendation columns: 12;
- approval-required columns: 1.

The approval-required mapping observed was:

`bronze_estado_registro -> bronze_estado_registro`

with risk:

`La normalización puede alterar valores sensibles a mayúsculas y minúsculas.`

Semantic mapping gates all passed:

- engine: PASS;
- logical target: PASS;
- incremental strategy: PASS;
- watermark: PASS;
- physical partition column: PASS;
- column count: PASS;
- human approval presence: PASS.

## Silver specification persistence

The authorized specification mutation was executed through the BFF.

Result:

- HTTP 200;
- workflow ID: `workflow_c7ab7e9ff9614576b2f49d5d6f65ebc1`;
- workflow version: 5;
- status: `IN_PROGRESS`;
- active step: 5;
- Business Rules status: `CONFIRMED`;
- spec ID: `spec_d21d52b1497245cbbc136f95aa4b3c7f`;
- mapping version: 1;
- mapping rules: 12;
- Silver target: `proyectopersonal-480420.seguros_silver.cat_producto`.

## Final contract validation

All final contract checks passed:

- `FINAL_CHECK_STATUS=True`;
- `FINAL_CHECK_ACTIVE_STEP=True`;
- `FINAL_CHECK_SPEC_ID=True`;
- `FINAL_CHECK_MAPPING_VERSION=True`;
- `FINAL_CHECK_TARGET=True`;
- `FINAL_CHECK_MAPPING_RULES=True`;
- `FINAL_CHECK_QUALITY_NOT_REVIEWED=True`.

Overall shell result:

`FLOW_RC=0`

## Physical target state after specification persistence

After the specification was persisted:

- `cat_producto` still did not exist physically in `seguros_silver`;
- destination table count remained 3;
- `TARGET_PHYSICAL=False`.

This confirms specification persistence alone did not create the physical BigQuery target table.

## Intentional stop boundary

The gate intentionally stopped at workflow step 5.

The following were NOT executed:

- quality review;
- artifact generation;
- DDL generation;
- notebook generation;
- PySpark script generation;
- artifact package generation;
- execution creation;
- package validation;
- Dataproc submission;
- Dataproc execution;
- physical Silver table creation through execution;
- frontend code changes;
- backend Silver code changes;
- Cloud Run changes;
- production traffic changes.

## Product conclusion

The product path now has verified evidence for:

`Bronze cat_producto -> confirmed schema -> confirmed Business Rules -> Intelligent Mapping -> persisted Silver contract -> logical target cat_producto`

while the target table remains purely logical and physically absent.

## Next gate

The next lifecycle transition is quality review for:

- workflow: `workflow_c7ab7e9ff9614576b2f49d5d6f65ebc1`;
- current workflow version: 5;
- spec: `spec_d21d52b1497245cbbc136f95aa4b3c7f`;
- current active step: 5;
- target: `proyectopersonal-480420.seguros_silver.cat_producto`.

Quality review is a separate backend workflow-state mutation and must not be executed without explicit approval.

Artifact generation and execution remain separate subsequent decisions even after quality review.

## Reuse rule

Do not recreate another workflow or repeat the contract-persistence gate unless the current workflow is intentionally abandoned, the Silver specification contract changes materially, the logical target changes, or the user explicitly asks for a fresh validation.