# Frontend Silver product baseline — 2026-08-07

## Purpose

Persist the verified frontend Silver discovery so subsequent work is based on repository facts instead of repeating the same discovery. Reuse this checkpoint unless the frontend branch baseline, Silver backend contract, production service, or relevant Silver UI/BFF code changes materially.

## Canonical frontend baseline

Repository:

`JuliusCordova/enterprise-dataops-platform-ui`

Working branch at discovery time:

`feature/unified-frontend-silver-integration`

Baseline commit:

`f3467a3feb25a0bb065ddf2e8aa15944d4f6cdee`

Baseline message:

`fix(silver-ui): clarify execution journey and handle artifact lists`

The branch already contains substantial Silver integration. Older architecture documents that still state that Silver is not integrated into the official frontend are stale relative to this baseline and must not be used as the current-state source of truth without revalidation.

## Verified frontend architecture

The Spring Boot / Thymeleaf frontend already separates the general DataOps backend from the Silver backend.

`src/main/resources/application.yml` defines:

- `dataops.api.base-url` from `DATAOPS_API_URL`
- `dataops.silver.base-url` from `SILVER_BACKEND_URL`
- the default Silver URL points to the `silver-refinement-agent` Cloud Run service

The frontend therefore does not need a second Silver frontend or a reconstruction of backend business logic in Java.

## Verified Silver BFF integration

The following dedicated Silver integration clients already exist:

- `SilverBackendClient`
- `SilverWorkflowClient`
- `SilverArtifactClient`
- `SilverExecutionClient`

Verified responsibilities include:

- workflow create/list/get
- source confirmation
- business-rule draft/generation/confirmation
- specification save
- quality review
- destination project/dataset/table catalog
- artifact listing and generation
- DDL generation
- execution creation
- package validation
- Dataproc submission
- execution status synchronization
- execution logs
- AgentOps metrics synchronization

The BFF exposes Silver routes under `/ui/api/silver/**` through:

- `SilverWorkflowApiController`
- `SilverOperationsApiController`

`SilverWorkflowService` delegates workflow operations to the dedicated Silver client.

## Verified current Silver UI

Silver templates and JavaScript already exist, including:

- `templates/silver-refinement/index.html`
- `templates/silver-refinement/new.html`
- `templates/silver-refinement/workflow.html`
- `static/js/silver-refinement/index.js`
- `static/js/silver-refinement/new.js`
- `static/js/silver-refinement/workflow.js`
- `static/js/silver-refinement/spec-gate.js`
- `static/js/silver-refinement/target-catalog.js`

The workflow experience already supports:

1. source / Bronze context
2. Bronze-to-Silver mapping editing
3. artifact and DDL generation
4. execution creation
5. package validation
6. Dataproc submission
7. execution status synchronization

The current workflow screen is therefore a real integrated experience, not a mockup.

## Verified production backend capability relevant to the next frontend slice

The production Silver backend provides:

`POST /silver-workflows/{workflow_id}/mapping-recommendations`

The response contains:

- recommended typed mapping columns
- transformation metadata
- confidence
- reason
- risk
- human-approval flag
- `load_strategy`
- `physical_design`

The deterministic recommendation engine can select `INCREMENTAL_WATERMARK` when an eligible temporal watermark column exists; otherwise it can fall back to `FULL`.

The backend load strategy model supports:

- `FULL`
- `APPEND`
- `INCREMENTAL_WATERMARK`
- `MERGE`
- `CDC`

For `INCREMENTAL_WATERMARK`, `watermark_column` is required. The model also supports `initial_watermark`, tie breaker, business keys, lookback configuration and late-arrival policy.

## Actual frontend gap at this baseline

The principal gap is not basic Silver integration. The gap is exposure of the newly productionized intelligent/incremental capability in the product experience.

At baseline `f3467a3`:

- the frontend does not expose a BFF route for `mapping-recommendations`;
- the workflow UI still builds mapping rows primarily from the confirmed source schema;
- `workflow.js` does not yet use the backend mapping recommendation response;
- the artifact-generation request does not yet explicitly carry the recommended `load_strategy` and `physical_design` from the new capability;
- the UI does not yet present incremental fields such as watermark strategy, watermark column, runtime watermark, next watermark or checkpoint version as first-class product information;
- AgentOps endpoints exist in the BFF, but the workflow experience does not yet surface their operational metrics as a dedicated incremental execution panel.

This is the scope to close next. Do not restart Silver backend discovery or rebuild existing workflow/artifact/execution clients.

## Validated local BFF slice after discovery

Immediately after this discovery, a local uncommitted change was applied on `feature/unified-frontend-silver-integration` to expose mapping recommendations through the existing BFF layering.

Modified files:

- `src/main/java/com/kyndryl/dataops/platform/integration/silver/SilverWorkflowClient.java`
- `src/main/java/com/kyndryl/dataops/platform/modules/silverrefinement/service/SilverWorkflowService.java`
- `src/main/java/com/kyndryl/dataops/platform/modules/silverrefinement/controller/SilverWorkflowApiController.java`

Added behavior:

- client `POST /silver-workflows/{workflowId}/mapping-recommendations`
- service delegation `generateMappingRecommendations(...)`
- BFF route `POST /ui/api/silver/workflows/{workflowId}/mapping-recommendations`

Validation evidence from Cloud Shell:

- `PATCH_RC=0`
- `DIFF_RC=0`
- `MAVEN_RC=0`
- exactly the three Java files above were modified
- no backend Silver modification
- no Cloud Run modification
- no production traffic modification
- no commit had yet been created at the time of this checkpoint

Because that change was still local when this checkpoint was persisted, this documentation branch intentionally does not advance or rewrite the working feature branch. The local BFF patch must be committed/pushed in a controlled next step before further UI work is layered on top.

## Next implementation sequence

The next frontend work should proceed from the verified current state in this order:

1. commit and push the validated mapping-recommendations BFF slice;
2. integrate the checkpoint into the working feature history without rewriting the release baseline;
3. add a `Recomendar mapping` action in the Silver workflow experience;
4. render recommended transformations, confidence, risk and human approval indicators;
5. render and allow controlled review of `load_strategy` and `physical_design`;
6. propagate `load_strategy` and `physical_design` into artifact-generation requests;
7. expose incremental execution information and AgentOps metrics in the UI;
8. validate UI -> BFF -> production Silver backend end to end before any frontend production release.

## Discovery reuse rule

Do not repeat this frontend discovery unless one of these changes materially:

- `feature/unified-frontend-silver-integration` is replaced by another integration baseline;
- the dedicated Silver backend configuration is removed or renamed;
- Silver BFF client/controller structure changes materially;
- the production mapping recommendation or execution contracts change;
- the Silver production service/revision changes in a way that affects the frontend contract;
- the user explicitly requests a fresh baseline review.

This checkpoint is the canonical frontend Silver product baseline for the next implementation steps.
