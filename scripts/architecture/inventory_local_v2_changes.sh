#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${LOCAL_V2_INVENTORY_DIR:-artifacts/local-v2-inventory}"
REPORT="$OUT_DIR/local-v2-inventory.md"
DIFF_FILE="$OUT_DIR/tracked-diff.patch"
STATUS_FILE="$OUT_DIR/git-status.txt"
UNTRACKED_FILE="$OUT_DIR/untracked-files.txt"

mkdir -p "$OUT_DIR"

printf '=== Sprint B0: Local V2 Inventory ===\n'
printf 'Repository: %s\n' "$ROOT_DIR"
printf 'Evidence: %s\n\n' "$OUT_DIR"

command -v git >/dev/null 2>&1 || { echo '[FAIL] git is required' >&2; exit 2; }

BRANCH="$(git branch --show-current)"
HEAD_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"

# Read-only evidence capture.
git status --short > "$STATUS_FILE"
git diff --binary > "$DIFF_FILE"
git ls-files --others --exclude-standard | sort > "$UNTRACKED_FILE"

python3 - "$REPORT" "$BRANCH" "$HEAD_SHA" "$STATUS_FILE" "$UNTRACKED_FILE" <<'PY'
import sys
from pathlib import Path

report_path = Path(sys.argv[1])
branch = sys.argv[2]
head = sys.argv[3]
status_path = Path(sys.argv[4])
untracked_path = Path(sys.argv[5])

status_lines = [line for line in status_path.read_text(encoding='utf-8').splitlines() if line.strip()]
untracked = [line for line in untracked_path.read_text(encoding='utf-8').splitlines() if line.strip()]

tracked_modified = []
for line in status_lines:
    if not line.startswith('??'):
        tracked_modified.append(line)

categories = {
    'SOURCE_CODE': [],
    'CONFIG_OR_DEPLOY': [],
    'GENERATED_ARTIFACT': [],
    'BACKUP': [],
    'INSTALLER_OR_ONE_OFF_SCRIPT': [],
    'DOCUMENTATION': [],
    'UNKNOWN': [],
}

for path in untracked:
    lower = path.lower()
    if lower.startswith('artifacts/') or '/target/' in lower or lower.endswith(('.class', '.jar')):
        categories['GENERATED_ARTIFACT'].append(path)
    elif lower.startswith('backup_') or '/backup_' in lower or lower.endswith(('.bak', '.backup')):
        categories['BACKUP'].append(path)
    elif lower.startswith('install_') or lower.endswith(('.sh', '.ps1')):
        categories['INSTALLER_OR_ONE_OFF_SCRIPT'].append(path)
    elif lower.endswith(('.java', '.kt', '.py', '.js', '.ts', '.css', '.html', '.xml', '.yml', '.yaml', '.properties')):
        categories['SOURCE_CODE'].append(path)
    elif lower in {'dockerfile'} or lower.startswith('.github/'):
        categories['CONFIG_OR_DEPLOY'].append(path)
    elif lower.endswith(('.md', '.txt', '.adoc')):
        categories['DOCUMENTATION'].append(path)
    else:
        categories['UNKNOWN'].append(path)

lines = [
    '# Inventario de cambios locales V2',
    '',
    f'- Branch: `{branch}`',
    f'- HEAD: `{head}`',
    f'- Archivos tracked modificados: **{len(tracked_modified)}**',
    f'- Archivos untracked: **{len(untracked)}**',
    '',
    '## 1. Archivos tracked modificados',
    '',
]

if tracked_modified:
    lines.extend(f'- `{item}`' for item in tracked_modified)
else:
    lines.append('- Ninguno')

lines += ['', '## 2. Archivos untracked clasificados', '']
for category, items in categories.items():
    lines.append(f'### {category}')
    lines.append('')
    if items:
        lines.extend(f'- `{item}`' for item in items)
    else:
        lines.append('- Ninguno')
    lines.append('')

lines += [
    '## 3. Regla de decisión',
    '',
    '| Clasificación | Acción permitida |',
    '|---|---|',
    '| `SOURCE_CODE` | Revisar y clasificar como KEEP / REWORK / DROP / UNKNOWN |',
    '| `CONFIG_OR_DEPLOY` | Revisar separadamente; nunca mezclar con cambios UX |',
    '| `DOCUMENTATION` | Preservar solo si describe el estado real |',
    '| `INSTALLER_OR_ONE_OFF_SCRIPT` | No versionar hasta demostrar necesidad permanente |',
    '| `BACKUP` | No versionar |',
    '| `GENERATED_ARTIFACT` | No versionar |',
    '| `UNKNOWN` | Bloquear hasta revisión manual |',
    '',
    '## 4. Próximo gate',
    '',
    'No crear commits funcionales hasta completar la matriz KEEP / REWORK / DROP / UNKNOWN para cada archivo fuente y de configuración.',
]

report_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
PY

printf '[DONE] Status:    %s\n' "$STATUS_FILE"
printf '[DONE] Untracked: %s\n' "$UNTRACKED_FILE"
printf '[DONE] Diff:      %s\n' "$DIFF_FILE"
printf '[DONE] Report:    %s\n' "$REPORT"
printf '[PASS] Inventory completed at HEAD %s\n' "$SHORT_SHA"
