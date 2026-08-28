#!/usr/bin/env bash

set -u
set -o pipefail

APP_PORT="${APP_PORT:-8080}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${APP_PORT}}"
JAR_PATH="${JAR_PATH:-target/enterprise-dataops-platform-ui-0.0.1-SNAPSHOT.jar}"
LOG_DIR="${LOG_DIR:-artifacts/v2-smoke}"
LOG_FILE="${LOG_DIR}/application.log"
RESULT_FILE="${LOG_DIR}/smoke-result.txt"
PID_FILE="${LOG_DIR}/application.pid"
START_TIMEOUT_SECONDS="${START_TIMEOUT_SECONDS:-60}"

mkdir -p "${LOG_DIR}"
: > "${RESULT_FILE}"

PASS=0
WARN=0
FAIL=0
STARTED_BY_SCRIPT=0
APP_PID=""

record() {
  local level="$1"
  shift
  printf '[%s] %s\n' "$level" "$*" | tee -a "${RESULT_FILE}"
  case "$level" in
    PASS) PASS=$((PASS + 1)) ;;
    WARN) WARN=$((WARN + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
  esac
}

cleanup() {
  if [[ "${STARTED_BY_SCRIPT}" -eq 1 && -n "${APP_PID}" ]]; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
    wait "${APP_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! command -v curl >/dev/null 2>&1; then
  record FAIL "curl no está disponible"
  exit 2
fi

if curl -fsS "${BASE_URL}/actuator/health" >/dev/null 2>&1; then
  record PASS "Aplicación ya disponible en ${BASE_URL}"
else
  if [[ ! -f "${JAR_PATH}" ]]; then
    record FAIL "No existe ${JAR_PATH}; ejecuta mvn package -DskipTests"
    exit 2
  fi

  record WARN "Aplicación no estaba activa; iniciándola temporalmente"
  java -jar "${JAR_PATH}" --server.port="${APP_PORT}" >"${LOG_FILE}" 2>&1 &
  APP_PID=$!
  STARTED_BY_SCRIPT=1
  printf '%s\n' "${APP_PID}" > "${PID_FILE}"

  for ((i=1; i<=START_TIMEOUT_SECONDS; i++)); do
    if curl -fsS "${BASE_URL}/actuator/health" >/dev/null 2>&1; then
      record PASS "Aplicación iniciada y actuator saludable"
      break
    fi
    if ! kill -0 "${APP_PID}" >/dev/null 2>&1; then
      record FAIL "La aplicación terminó durante el arranque; revisar ${LOG_FILE}"
      tail -n 80 "${LOG_FILE}" | tee -a "${RESULT_FILE}"
      exit 1
    fi
    sleep 1
  done

  if ! curl -fsS "${BASE_URL}/actuator/health" >/dev/null 2>&1; then
    record FAIL "Timeout esperando actuator/health"
    tail -n 80 "${LOG_FILE}" | tee -a "${RESULT_FILE}"
    exit 1
  fi
fi

check_page() {
  local path="$1"
  local expected="$2"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -o "${tmp}" -w '%{http_code}' "${BASE_URL}${path}" || true)"
  if [[ "$code" == "200" ]] && grep -Fq "$expected" "${tmp}"; then
    record PASS "${path} respondió 200 y contiene '${expected}'"
  elif [[ "$code" == "200" ]]; then
    record WARN "${path} respondió 200, pero no contiene '${expected}'"
  else
    record FAIL "${path} respondió HTTP ${code}"
  fi
  rm -f "${tmp}"
}

check_asset() {
  local path="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${path}" || true)"
  if [[ "$code" == "200" ]]; then
    record PASS "Asset ${path} disponible"
  else
    record FAIL "Asset ${path} respondió HTTP ${code}"
  fi
}

check_page "/profiling-v2" "Data Profiling"
check_page "/quality-rules-v2" "Quality Rules"
check_page "/reconciliation" "Reconciliation"
check_page "/reconciliation/new" "Reconciliation"

check_asset "/css/data-quality-experience-v2.css"
check_asset "/css/reconciliation-wizard-v2.css"
check_asset "/js/profiling/experience-v2.js"
check_asset "/js/quality-rules/suggestions-v2.js"
check_asset "/js/reconciliation/wizard.js"

printf '\nSummary: PASS=%s WARN=%s FAIL=%s\n' "$PASS" "$WARN" "$FAIL" | tee -a "${RESULT_FILE}"
printf 'Evidence: %s\n' "${RESULT_FILE}" | tee -a "${RESULT_FILE}"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
