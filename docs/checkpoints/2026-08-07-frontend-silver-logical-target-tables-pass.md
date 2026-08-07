# Frontend Silver Logical Target Tables PASS — 2026-08-07

## Purpose

Persist the verified implementation state for supporting logical Silver target tables in the unified Silver wizard. This checkpoint is the canonical baseline for the next end-to-end validation and must be reused instead of repeating discovery.

## Branch and commit

Repository:

`JuliusCordova/enterprise-dataops-platform-ui`

Branch:

`feature/unified-frontend-silver-integration`

Validated implementation commit:

`fc2a0021740bf57ec7a334fe8392b4dcaeda0501`

Commit message:

`feat(silver-ui): support logical Silver target tables`

Parent checkpoint commit:

`c2e7f74e6c23341611048c72a4d8c85e7f566584`

## Verified file scope

The implementation commit is exactly one commit ahead of the parent checkpoint and modifies only:

- `src/main/resources/static/js/silver-refinement/new.js`
- `src/main/resources/templates/silver-refinement/new.html`

No backend Silver code changed.

No Cloud Run service changed.

No production traffic changed.

## Product capability implemented

Step 4 now supports two target-table modes:

1. `Nueva tabla Silver`
2. `Tabla existente`

`Nueva tabla Silver` allows the user to enter a valid logical target table name even when the physical BigQuery table does not yet exist.

Selecting or entering a logical target does not create the physical table by itself.

The target table value is resolved through a single logical target abstraction and is reused consistently by:

- target summary;
- mapping recommendation request;
- Silver specification save request;
- artifact generation request.

## Validation and target-name guardrails

The frontend validates the logical target table name with the accepted resource-name pattern:

- starts with a letter or underscore;
- contains only letters, numbers, or underscores;
- maximum length aligned with the existing backend resource identifier limit.

When `Nueva tabla Silver` is selected and the entered table already exists in the loaded destination catalog, the UI stops and directs the user to use `Tabla existente` instead.

For new targets, the wizard can suggest the source table name as the logical Silver target name.

## Recommendation invalidation

Changing any target-defining input invalidates the previous recommendation context:

- target project;
- target dataset;
- target mode;
- existing target table;
- new logical target table;
- source table when it changes the suggested target.

The invalidation resets:

- mapping recommendation;
- load strategy to the safe default context;
- physical-design recommendation;
- strategy presentation.

This prevents silently reusing a recommendation generated for another target.

## Contract-to-target consistency guardrail

The frontend now computes both:

- current UI target key;
- persisted Silver contract target key.

Before progressing from Step 4 and before generating artifacts, the current target must match the target persisted in `state.workflow.silver_target` for the existing `spec_id`.

If the target changed after saving the contract, the user must save the Silver contract again before continuing.

This prevents mixing a persisted contract for target A with a UI target B.

## Downstream runtime invalidation

When the target changes, target-dependent runtime state is cleared in memory:

- generated artifact references;
- execution state;
- AgentOps metrics state;
- execution logs state.

The UI also resets the visible artifact and execution controls to pending/disabled state.

This prevents previously generated artifacts or execution evidence from being presented as valid for a newly selected target.

## Validation evidence

Final pre-commit gate:

- `DIFF_RC=0`
- `NODE_RC=0`
- `MAVEN_RC=0`

Controlled stage gate:

- `CACHED_RC=0`

Commit/push gate:

- `COMMIT_RC=0`
- `PUSH_RC=0`

Earlier implementation guards also passed:

- `PATCH_RC=0`
- `CONTRACT_RC=0`
- `DIRECT_GATE_RC=0`
- `GUARD_RC=0`
- `DOWNSTREAM_RC=0`
- `TARGET_RC=0`

`node --check` is a JavaScript syntax gate only.

`mvn -q -DskipTests package` is a compile/package gate with tests skipped; it is not evidence that automated tests ran.

## Remote verification

GitHub verified the implementation commit as:

`fc2a0021740bf57ec7a334fe8392b4dcaeda0501`

and verified it is exactly one commit ahead of the prior checkpoint `c2e7f74e6c23341611048c72a4d8c85e7f566584` with only the two expected frontend files changed.

## Product state after this slice

The previously observed E2E gap is now addressed at implementation level:

`seguros_bronce.cat_producto -> seguros_silver.cat_producto`

can be represented as a logical Bronze-to-Silver design even if `seguros_silver.cat_producto` does not yet exist physically.

The next step is to validate this behavior through the running frontend/BFF against the existing production Silver backend before proceeding to contract persistence, artifact generation, or execution.

## Next E2E validation slice

Validate the actual wizard behavior for:

- source `seguros_bronce.cat_producto`;
- destination dataset `seguros_silver`;
- target mode `Nueva tabla Silver`;
- logical target table `cat_producto`;
- mapping recommendation through the BFF;
- visible `INCREMENTAL_WATERMARK` recommendation;
- visible `bronze_fecha_ingesta` watermark;
- physical design and approval/risk information;
- confirmation that no physical target table is created by target selection/recommendation.

Do not save a new specification, generate artifacts, create an execution, change the Silver backend, change Cloud Run, or change production traffic during this validation unless explicitly approved as a separate step.

## Reuse rule

Do not repeat target-mode discovery or the earlier Intelligent Mapping discovery unless one of these changes materially:

- frontend target-selection implementation;
- target validation rules;
- mapping recommendation contract;
- specification/artifact target contract;
- destination catalog behavior;
- production Silver backend contract;
- the user explicitly requests a fresh baseline review.

This checkpoint is the canonical PASS record for logical Silver target-table support.