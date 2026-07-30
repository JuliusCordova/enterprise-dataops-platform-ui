#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BACKEND_URL="${RECONCILIATION_BACKEND_BASE_URL:-${DATAOPS_API_URL:-https://jarvis-reconciliation-agent-913797829604.us-central1.run.app}}"
BACKEND_URL="${BACKEND_URL%/}"
OUT_DIR="${OPENAPI_EVIDENCE_DIR:-artifacts/reconciliation-contract-certification}"
OPENAPI_FILE="$OUT_DIR/openapi.json"
REPORT_FILE="$OUT_DIR/compatibility-report.md"
HTTP_FILE="$OUT_DIR/http-evidence.txt"

mkdir -p "$OUT_DIR"
: > "$HTTP_FILE"

PASS=0
WARN=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf '[PASS] %s\n' "$*"; }
warn() { WARN=$((WARN + 1)); printf '[WARN] %s\n' "$*"; }
fail() { FAIL=$((FAIL + 1)); printf '[FAIL] %s\n' "$*" >&2; }

printf '=== Sprint A: Reconciliation OpenAPI Certification ===\n'
printf 'Backend: %s\n' "$BACKEND_URL"
printf 'Evidence: %s\n\n' "$OUT_DIR"

command -v curl >/dev/null 2>&1 && pass 'curl available' || { fail 'curl is required'; exit 2; }
command -v python3 >/dev/null 2>&1 && pass 'python3 available' || { fail 'python3 is required'; exit 2; }

fetch_openapi() {
  local url="$1"
  local auth_header="${2:-}"
  local tmp_body="$OUT_DIR/openapi.tmp"
  local status

  if [[ -n "$auth_header" ]]; then
    status="$(curl --silent --show-error --location \
      --connect-timeout 10 --max-time 45 \
      --header "$auth_header" \
      --output "$tmp_body" \
      --write-out '%{http_code}' \
      "$url" || true)"
  else
    status="$(curl --silent --show-error --location \
      --connect-timeout 10 --max-time 45 \
      --output "$tmp_body" \
      --write-out '%{http_code}' \
      "$url" || true)"
  fi

  printf '%s %s\n' "$status" "$url" >> "$HTTP_FILE"

  if [[ "$status" == "200" ]] && python3 -m json.tool "$tmp_body" >/dev/null 2>&1; then
    mv "$tmp_body" "$OPENAPI_FILE"
    return 0
  fi

  rm -f "$tmp_body"
  return 1
}

OPENAPI_PATHS=(
  "/openapi.json"
  "/api/openapi.json"
  "/v3/api-docs"
)

FOUND=0
for path in "${OPENAPI_PATHS[@]}"; do
  if fetch_openapi "$BACKEND_URL$path"; then
    pass "OpenAPI downloaded from $path without authentication"
    FOUND=1
    break
  fi
done

if [[ "$FOUND" -eq 0 ]] && command -v gcloud >/dev/null 2>&1; then
  TOKEN="$(gcloud auth print-identity-token --audiences="$BACKEND_URL" 2>/dev/null || true)"
  if [[ -n "$TOKEN" ]]; then
    warn 'Public OpenAPI access unavailable; retrying with a temporary Google identity token'
    for path in "${OPENAPI_PATHS[@]}"; do
      if fetch_openapi "$BACKEND_URL$path" "Authorization: Bearer $TOKEN"; then
        pass "OpenAPI downloaded from $path using federated/user identity"
        FOUND=1
        break
      fi
    done
  else
    warn 'No Google identity token could be generated'
  fi
fi

if [[ "$FOUND" -eq 0 ]]; then
  fail 'OpenAPI could not be downloaded from known paths'
  {
    echo '# Contract certification blocked'
    echo
    echo "Backend: \`$BACKEND_URL\`"
    echo
    echo 'OpenAPI was not available from `/openapi.json`, `/api/openapi.json`, or `/v3/api-docs` using public access or the current Google identity.'
    echo
    echo 'Review `http-evidence.txt` and confirm whether the Cloud Run service requires a different audience, path, or IAM permission.'
  } > "$REPORT_FILE"
  printf '\nSummary: PASS=%d WARN=%d FAIL=%d\n' "$PASS" "$WARN" "$FAIL"
  exit 2
fi

python3 - "$OPENAPI_FILE" "$REPORT_FILE" "$BACKEND_URL" <<'PY'
import json
import sys
from pathlib import Path

openapi_path = Path(sys.argv[1])
report_path = Path(sys.argv[2])
backend_url = sys.argv[3]

doc = json.loads(openapi_path.read_text(encoding="utf-8"))
paths = doc.get("paths", {})

# domain, method, canonical path, accepted aliases
expected = [
    ("Profiling", "GET", "/connections", []),
    ("Profiling", "GET", "/metadata/{connection_id}/datasets", []),
    ("Profiling", "GET", "/metadata/{connection_id}/{dataset_id}/tables", []),
    ("Profiling", "GET", "/metadata/{connection_id}/{dataset_id}/{table_id}/columns", []),
    ("Profiling", "POST", "/profiling/execute", ["/data-quality/profile"]),
    ("Profiling", "POST", "/profiling/profile", ["/data-quality/profile"]),
    ("Quality", "GET", "/data-quality/rule-types", []),
    ("Quality", "POST", "/data-quality/configure/draft", []),
    ("Quality", "GET", "/data-quality/configure/draft/{draft_id}", []),
    ("Quality", "PUT", "/data-quality/configure/draft/{draft_id}", []),
    ("Quality", "POST", "/data-quality/configure/validate/{draft_id}", []),
    ("Quality", "POST", "/data-quality/configure/confirm/{draft_id}", []),
    ("Quality", "GET", "/data-quality/configurations", ["/data-quality/configs"]),
    ("Quality", "GET", "/data-quality/configurations/{id}", ["/data-quality/config/{quality_config_id}"]),
    ("Quality", "POST", "/data-quality/configurations/{id}/versions", []),
    ("Quality", "PATCH", "/data-quality/configurations/{id}/status", []),
    ("Quality", "DELETE", "/data-quality/configurations/{id}", []),
    ("Quality", "GET", "/data-quality/configurations/{id}/versions", []),
    ("Reconciliation", "GET", "/reconciliation/configs", []),
    ("Reconciliation", "POST", "/reconciliation/configure/draft", []),
    ("Reconciliation", "GET", "/reconciliation/configure/draft/{draft_id}", []),
    ("Reconciliation", "PUT", "/reconciliation/configure/draft/{draft_id}", []),
    ("Reconciliation", "POST", "/reconciliation/configure/validate/{draft_id}", []),
    ("Reconciliation", "POST", "/reconciliation/configure/confirm/{draft_id}", []),
    ("Reconciliation", "POST", "/reconciliation/execute", []),
    ("Reconciliation", "GET", "/reconciliation/result/{execution_id}", []),
    ("Reconciliation", "POST", "/reconciliation/ask", []),
    ("Reconciliation", "GET", "/reconciliation/configurations", ["/reconciliation/configs"]),
    ("Reconciliation", "GET", "/reconciliation/configurations/{id}", []),
    ("Reconciliation", "POST", "/reconciliation/configurations/{id}/versions", []),
    ("Reconciliation", "PATCH", "/reconciliation/configurations/{id}/status", []),
    ("Reconciliation", "DELETE", "/reconciliation/configurations/{id}", []),
    ("Reconciliation", "GET", "/reconciliation/configurations/{id}/versions", []),
]

def normalize(path: str) -> str:
    parts = []
    for part in path.strip("/").split("/"):
        if part.startswith("{") and part.endswith("}"):
            parts.append("{}")
        else:
            parts.append(part)
    return "/" + "/".join(parts)

actual_index = {}
for path, operations in paths.items():
    for method, operation in operations.items():
        if method.lower() not in {"get", "post", "put", "patch", "delete"}:
            continue
        actual_index[(method.upper(), normalize(path))] = (path, operation)

rows = []
for domain, method, expected_path, aliases in expected:
    found = actual_index.get((method, normalize(expected_path)))
    status = "MISSING"
    actual_path = "—"
    detail = ""
    note = ""

    if found:
        actual_path, operation = found
        status = "EXISTS"
        detail = operation.get("operationId", "") if isinstance(operation, dict) else ""
    else:
        for alias in aliases:
            alias_found = actual_index.get((method, normalize(alias)))
            if alias_found:
                actual_path, operation = alias_found
                status = "PARTIAL"
                detail = operation.get("operationId", "") if isinstance(operation, dict) else ""
                note = "Alias funcional; requiere adaptación o estandarización"
                break

    rows.append((domain, method, expected_path, actual_path, status, detail, note))

counts = {}
for *_, status, _, _ in rows:
    counts[status] = counts.get(status, 0) + 1

lines = [
    "# Certificación de contrato — jarvis-reconciliation-agent",
    "",
    f"- Backend: `{backend_url}`",
    f"- OpenAPI: `{doc.get('openapi', doc.get('swagger', 'unknown'))}`",
    f"- Título: `{doc.get('info', {}).get('title', 'unknown')}`",
    f"- Endpoints reales: **{len(actual_index)}**",
    f"- EXISTS: **{counts.get('EXISTS', 0)}**",
    f"- PARTIAL: **{counts.get('PARTIAL', 0)}**",
    f"- MISSING: **{counts.get('MISSING', 0)}**",
    "",
    "## Matriz de compatibilidad",
    "",
    "| Dominio | Método | Contrato esperado | Endpoint real | Estado | operationId | Nota |",
    "|---|---|---|---|---|---|---|",
]
for row in rows:
    values = []
    for i, value in enumerate(row):
        if i in {1, 2, 3, 5} and value != "—":
            values.append(f"`{value}`")
        else:
            values.append(str(value))
    lines.append("| " + " | ".join(values) + " |")

lines += [
    "",
    "## Interpretación",
    "",
    "- `EXISTS`: el método y path coinciden con el contrato esperado.",
    "- `PARTIAL`: existe una operación funcionalmente equivalente con otro path; requiere adapter BFF o estandarización backend.",
    "- `MISSING`: no se encontró operación equivalente en el OpenAPI.",
    "",
    "## Inventario completo del OpenAPI",
    "",
    "| Método | Path | operationId |",
    "|---|---|---|",
]
for (method, _), (path, operation) in sorted(actual_index.items(), key=lambda x: (x[1][0], x[0][0])):
    operation_id = operation.get("operationId", "") if isinstance(operation, dict) else ""
    lines.append(f"| `{method}` | `{path}` | `{operation_id}` |")

report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

pass 'Compatibility matrix generated'

if grep -q '| MISSING |' "$REPORT_FILE"; then
  warn 'Missing endpoints were detected; review the compatibility report'
elif grep -q '| PARTIAL |' "$REPORT_FILE"; then
  warn 'Compatible aliases were detected; review BFF/backend alignment'
else
  pass 'All expected endpoints were found'
fi

printf '\nSummary: PASS=%d WARN=%d FAIL=%d\n' "$PASS" "$WARN" "$FAIL"
printf '[DONE] OpenAPI: %s\n' "$OPENAPI_FILE"
printf '[DONE] Report:  %s\n' "$REPORT_FILE"
