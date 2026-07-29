#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-.}"
OUT="${2:-artifacts/frontend-integration-inventory.txt}"
mkdir -p "$(dirname "$OUT")"

{
  echo "=== Enterprise DataOps Platform UI — Integration Inventory ==="
  echo "Root: $ROOT"
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo

  echo "=== Java files ==="
  find "$ROOT/src/main/java" -type f -name '*.java' | sort || true
  echo

  echo "=== Controllers and services ==="
  grep -RInE --include='*.java' \
    '@Controller|@RestController|@Service|class .*Controller|class .*Service' \
    "$ROOT/src/main/java" || true
  echo

  echo "=== HTTP clients and outbound calls ==="
  grep -RInE --include='*.java' \
    'RestClient|WebClient|RestTemplate|HttpClient|FeignClient|\.get\(|\.post\(|\.put\(|\.delete\(|retrieve\(|exchange\(' \
    "$ROOT/src/main/java" || true
  echo

  echo "=== Backend URLs and configuration keys ==="
  grep -RInE \
    --include='*.java' --include='*.yml' --include='*.yaml' --include='*.properties' --include='*.html' --include='*.js' \
    'https?://|base-url|baseUrl|backend|reconciliation|profiling|quality|silver|cloud run|run.app' \
    "$ROOT/src/main" || true
  echo

  echo "=== Module references ==="
  for module in profiling qualityrules qualityexecution reconciliation; do
    echo "--- $module ---"
    grep -RIn --include='*.java' --include='*.html' --include='*.js' --include='*.css' "$module" "$ROOT/src/main" || true
    echo
  done

  echo "=== Mock and hardcoded evidence ==="
  grep -RInE \
    --include='*.java' --include='*.html' --include='*.js' \
    'mock|dummy|sample|hardcoded|TODO|FIXME|List\.of\(|Map\.of\(' \
    "$ROOT/src/main" || true
  echo

  echo "=== Application configuration ==="
  find "$ROOT/src/main/resources" -maxdepth 2 -type f \
    \( -name 'application*.yml' -o -name 'application*.yaml' -o -name 'application*.properties' \) \
    -print -exec sed -n '1,220p' {} \; || true
} | tee "$OUT"

echo
printf '[DONE] Inventory written to %s\n' "$OUT"
