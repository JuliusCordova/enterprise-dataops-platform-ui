#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${V2_CONSOLIDATION_EVIDENCE_DIR:-artifacts/v2-consolidation-inventory}"
MANIFEST="$OUT_DIR/manifest.tsv"
REPORT="$OUT_DIR/report.md"
DIFF_DIR="$OUT_DIR/diffs"

mkdir -p "$DIFF_DIR"
: > "$MANIFEST"

printf 'path\tgit_status\tclassification\tsha256\tsize_bytes\tnotes\n' >> "$MANIFEST"

PRODUCTIVE_FILES=(
  "Dockerfile"
  "src/main/java/com/kyndryl/dataops/platform/modules/reconciliation/dto/ReconciliationDraftCreateRequest.java"
  "src/main/java/com/kyndryl/dataops/platform/modules/reconciliation/dto/ReconciliationDraftUpdateRequest.java"
  "src/main/resources/static/css/enterprise-theme.css"
  "src/main/resources/static/js/reconciliation/wizard.js"
  "src/main/resources/templates/fragments/layout.html"
  "src/main/resources/templates/quality-rules/index.html"
  "src/main/resources/templates/reconciliation/index.html"
  "src/main/resources/templates/reconciliation/new.html"
  "src/main/java/com/kyndryl/dataops/platform/modules/profiling/controller/ProfilingExperienceV2Controller.java"
  "src/main/java/com/kyndryl/dataops/platform/modules/qualityrules/controller/QualityRulesExperienceV2Controller.java"
  "src/main/resources/static/css/data-quality-experience-v2.css"
  "src/main/resources/static/css/reconciliation-wizard-v2.css"
  "src/main/resources/static/js/profiling/experience-v2.js"
  "src/main/resources/static/js/quality-rules/suggestions-v2.js"
  "src/main/resources/templates/profiling/index-v2.html"
  "src/main/resources/templates/quality-rules/index-v2.html"
)

SUPPORT_FILES=(
  "README_INSTALACION.md"
  "install_wizard_v2.sh"
)

EXCLUDED_PREFIXES=(
  "artifacts/"
  "backup_before_dq_v2/"
  "backup_before_wizard_v2/"
)

status_for() {
  local path="$1"
  git status --short -- "$path" | head -n 1 | sed 's/[[:space:]]*$//' || true
}

classify() {
  local path="$1"
  local item
  for item in "${PRODUCTIVE_FILES[@]}"; do
    [[ "$path" == "$item" ]] && { printf 'PRODUCTIVO'; return; }
  done
  for item in "${SUPPORT_FILES[@]}"; do
    [[ "$path" == "$item" ]] && { printf 'SOPORTE_REVISAR'; return; }
  done
  for item in "${EXCLUDED_PREFIXES[@]}"; do
    [[ "$path" == "$item"* ]] && { printf 'EXCLUIR'; return; }
  done
  printf 'NO_CLASIFICADO'
}

mapfile -t paths < <(
  {
    git diff --name-only
    git ls-files --others --exclude-standard
  } | awk 'NF' | sort -u
)

for path in "${paths[@]}"; do
  classification="$(classify "$path")"
  status="$(status_for "$path")"
  sha=""
  size=""
  notes=""

  if [[ -f "$path" ]]; then
    sha="$(sha256sum "$path" | awk '{print $1}')"
    size="$(wc -c < "$path" | tr -d ' ')"
  else
    notes="no es archivo regular"
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$path" "$status" "$classification" "$sha" "$size" "$notes" >> "$MANIFEST"

  if [[ "$classification" == "PRODUCTIVO" ]] && git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    safe_name="${path//\//__}"
    git diff -- "$path" > "$DIFF_DIR/${safe_name}.diff" || true
  fi
done

python3 - "$MANIFEST" "$REPORT" <<'PY'
import csv
import sys
from collections import Counter
from pathlib import Path

manifest = Path(sys.argv[1])
report = Path(sys.argv[2])
rows = list(csv.DictReader(manifest.open(encoding="utf-8"), delimiter="\t"))
counts = Counter(row["classification"] for row in rows)

lines = [
    "# Inventario local V2 para consolidación",
    "",
    f"- Total de rutas detectadas: **{len(rows)}**",
    f"- Productivo: **{counts.get('PRODUCTIVO', 0)}**",
    f"- Soporte por revisar: **{counts.get('SOPORTE_REVISAR', 0)}**",
    f"- Excluir: **{counts.get('EXCLUIR', 0)}**",
    f"- No clasificado: **{counts.get('NO_CLASIFICADO', 0)}**",
    "",
    "## Detalle",
    "",
    "| Ruta | Estado Git | Clasificación | SHA-256 | Bytes |",
    "|---|---|---|---|---:|",
]
for row in rows:
    lines.append(
        f"| `{row['path']}` | `{row['git_status']}` | **{row['classification']}** | `{row['sha256']}` | {row['size_bytes'] or '—'} |"
    )

lines += [
    "",
    "## Regla de consolidación",
    "",
    "Solo las rutas `PRODUCTIVO` aprobadas se incluirán mediante `git add -- <ruta...>` explícito.",
    "No se usará `git add -A`, `git clean`, `git reset --hard` ni se versionarán respaldos o `artifacts/`.",
]
report.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

printf '=== Inventario local V2 ===\n'
printf 'Manifest: %s\n' "$MANIFEST"
printf 'Report:   %s\n' "$REPORT"
printf '\n'
cat "$REPORT"
