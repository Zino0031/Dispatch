#!/usr/bin/env bash
# CI smoke (no Supabase in CI): boot, health, upload, offline dispatch (503),
# wrong-token negatives (401/404). Kiosk auth requires Supabase, so the
# PRINT_SUCCESS path is covered with a Supabase-backed backend (local/pilot),
# where npm run fake-kiosk simulates the full sequence.
set -euo pipefail
cd "$(dirname "$0")/../apps/backend"

export ADMIN_TOKEN=ci-admin
export KIOSK_ENROLLMENT_TOKEN=ci-enroll
export PORT="${SMOKE_PORT:-4100}"
BASE="http://localhost:${PORT}"

node dist/index.js > /tmp/ci-backend.log 2>&1 &
BE_PID=$!
cleanup() { kill "$BE_PID" 2>/dev/null || true; }
trap cleanup EXIT

for i in $(seq 1 30); do
  curl -sSf "${BASE}/health" > /dev/null 2>&1 && break
  sleep 1
done
echo "health: $(curl -sS "${BASE}/health")"

printf '%%PDF-1.4 smoke' > /tmp/ci-doc.pdf
UP=$(curl -sS -X POST "${BASE}/api/upload" -F 'file=@/tmp/ci-doc.pdf;type=application/pdf')
echo "upload: $UP"
FURL=$(echo "$UP" | python3 -c "import json,sys;print(json.load(sys.stdin)['fileUrl'])")

OFFLINE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/print-job" \
  -H "Content-Type: application/json" \
  -d "{\"kioskId\":\"ghost\",\"fileUrl\":\"$FURL\",\"copies\":1,\"color\":\"bw\",\"duplex\":false}")
echo "offline dispatch: $OFFLINE (want 503)"
[ "$OFFLINE" = "503" ] || exit 1

ADMIN401=$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/admin/overview" -H "x-admin-token: wrong")
echo "wrong admin token: $ADMIN401 (want 401)"
[ "$ADMIN401" = "401" ] || exit 1

JOB404=$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/print-job/nope" -H "x-print-job-token: wrong")
echo "unknown job: $JOB404 (want 404)"
[ "$JOB404" = "404" ] || exit 1

echo "SMOKE PASS"
