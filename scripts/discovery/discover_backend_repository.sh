#!/usr/bin/env bash
set -u
set -o pipefail

ROOT="${1:-$HOME}"
OUTPUT="${2:-artifacts/backend-discovery/backend-repository-evidence.txt}"
mkdir -p "$(dirname "$OUTPUT")"

{
  echo "Backend repository discovery"
  echo "Generated at: $(date -Iseconds)"
  echo "Search root: $ROOT"
  echo

  echo "=== Candidate directories ==="
  find "$ROOT" -maxdepth 4 -type d \( \
    -iname '*jarvis*' -o \
    -iname '*reconciliation*' -o \
    -iname '*quality*' -o \
    -iname '*dataops*' \
  \) 2>/dev/null | sort

  echo
  echo "=== Git repositories ==="
  found=0
  while IFS= read -r gitdir; do
    found=1
    repo="${gitdir%/.git}"
    echo
    echo "Repository: $repo"
    echo "Branch: $(git -C "$repo" branch --show-current 2>/dev/null || true)"
    echo "HEAD: $(git -C "$repo" rev-parse --short HEAD 2>/dev/null || true)"
    echo "Origin: $(git -C "$repo" remote get-url origin 2>/dev/null || echo 'NO_ORIGIN')"
    echo "Top-level files:"
    find "$repo" -maxdepth 1 -mindepth 1 -printf '  %f\n' 2>/dev/null | sort | head -n 30

    if grep -RIl --exclude-dir=.git \
      -e 'jarvis-reconciliation-agent' \
      -e '/reconciliation/configure/draft' \
      -e '/data-quality/configure/draft' \
      -e 'JARVIS TiendaNova API' \
      "$repo" 2>/dev/null | head -n 1 | grep -q .; then
      echo "Match: JARVIS_BACKEND_CANDIDATE"
    else
      echo "Match: no canonical Jarvis marker found"
    fi
  done < <(find "$ROOT" -maxdepth 5 -type d -name .git 2>/dev/null | sort)

  if [[ "$found" -eq 0 ]]; then
    echo "No Git repositories found under $ROOT"
  fi

  echo
  echo "=== Selection criteria ==="
  echo "A valid backend candidate must include backend source code, an origin remote, a base branch, and at least one certified Jarvis route or OpenAPI marker."
} | tee "$OUTPUT"

echo
echo "Evidence: $OUTPUT"
