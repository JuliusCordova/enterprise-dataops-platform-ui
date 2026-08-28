#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SOURCE_BRANCH="architecture/backend-routing-matrix"
TARGET_BRANCH="feature/consolidate-v2-experiences"

PRODUCTIVE_FILES=(
  "Dockerfile"
  "src/main/java/com/kyndryl/dataops/platform/modules/profiling/controller/ProfilingExperienceV2Controller.java"
  "src/main/java/com/kyndryl/dataops/platform/modules/qualityrules/controller/QualityRulesExperienceV2Controller.java"
  "src/main/java/com/kyndryl/dataops/platform/modules/reconciliation/dto/ReconciliationDraftCreateRequest.java"
  "src/main/java/com/kyndryl/dataops/platform/modules/reconciliation/dto/ReconciliationDraftUpdateRequest.java"
  "src/main/resources/static/css/data-quality-experience-v2.css"
  "src/main/resources/static/css/enterprise-theme.css"
  "src/main/resources/static/css/reconciliation-wizard-v2.css"
  "src/main/resources/static/js/profiling/experience-v2.js"
  "src/main/resources/static/js/quality-rules/suggestions-v2.js"
  "src/main/resources/static/js/reconciliation/wizard.js"
  "src/main/resources/templates/fragments/layout.html"
  "src/main/resources/templates/profiling/index-v2.html"
  "src/main/resources/templates/quality-rules/index.html"
  "src/main/resources/templates/quality-rules/index-v2.html"
  "src/main/resources/templates/reconciliation/index.html"
  "src/main/resources/templates/reconciliation/new.html"
)

printf '=== Consolidación controlada V2 ===\n'
printf 'Rama origen:  %s\n' "$SOURCE_BRANCH"
printf 'Rama destino: %s\n\n' "$TARGET_BRANCH"

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$SOURCE_BRANCH" && "$current_branch" != "$TARGET_BRANCH" ]]; then
  printf '[BLOCKED] Ejecutar desde %s o %s. Rama actual: %s\n' "$SOURCE_BRANCH" "$TARGET_BRANCH" "$current_branch" >&2
  exit 2
fi

for path in "${PRODUCTIVE_FILES[@]}"; do
  if [[ ! -e "$path" ]]; then
    printf '[BLOCKED] Falta archivo productivo esperado: %s\n' "$path" >&2
    exit 2
  fi
done

if [[ "$current_branch" == "$SOURCE_BRANCH" ]]; then
  if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    printf '[INFO] La rama local %s ya existe; cambiando a ella.\n' "$TARGET_BRANCH"
    git switch "$TARGET_BRANCH"
  else
    printf '[INFO] Creando rama %s desde HEAD actual.\n' "$TARGET_BRANCH"
    git switch -c "$TARGET_BRANCH"
  fi
fi

printf '\n[INFO] Limpiando únicamente el staging area, sin tocar archivos locales.\n'
git restore --staged . 2>/dev/null || true

printf '[INFO] Agregando solo rutas PRODUCTIVO aprobadas.\n'
git add -- "${PRODUCTIVE_FILES[@]}"

printf '\n=== Archivos staged ===\n'
git diff --cached --name-status

if git diff --cached --quiet; then
  printf '[BLOCKED] No hay cambios staged para consolidar.\n' >&2
  exit 3
fi

printf '\n[INFO] Ejecutando build Maven.\n'
if [[ -x "./mvnw" ]]; then
  ./mvnw -q -DskipTests=false test
elif command -v mvn >/dev/null 2>&1; then
  mvn -q -DskipTests=false test
else
  printf '[BLOCKED] No se encontró ./mvnw ni mvn.\n' >&2
  exit 4
fi

printf '\n[PASS] Build exitoso.\n'
printf '[INFO] Creando commit controlado.\n'
git commit -m "feat(ui): consolidate V2 profiling quality and reconciliation experiences"

printf '\n[PASS] Consolidación local completada.\n'
printf 'Branch: %s\n' "$(git branch --show-current)"
printf 'HEAD:   %s\n' "$(git rev-parse --short HEAD)"
printf '\nPendientes no versionados conservados:\n'
git status --short
