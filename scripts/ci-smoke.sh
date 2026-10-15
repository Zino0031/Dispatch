#!/usr/bin/env bash
# CI smoke per app (issue #21): boot backend, enroll, fake-kiosk dispatch to
# PRINT_SUCCESS, offline 503, wrong-token 401/404. Also runnable locally.
set -euo pipefail
cd "$(dirname "$0")/../apps/backend"

export ADMIN_TOKEN=ci-admin
export KIOSK_ENROLLMENT_TOKEN=ci-enroll
export PORT="${SMOKE_PORT:-4100}"
BASE="http://localhost:${PORT}"

node dist/index.js > /tmp/ci-backend.log 2>&1 &
BE_PID=$!
cleanup() { kill "$BE_PID" "$FK_PID" 2>/dev/null || true; }
trap cleanup EXIT

for i in $(seq 1 30); do
  curl -sSf "${BASE}/health" > /dev/null 2>&1 && break
  sleep 1
done
echo "health: $(curl -sS "${BASE}/health")"

ENR=$(curl -sS -X POST "${BASE}/api/admin/kiosks/enroll" -H "x-admin-token: ci-admin" \
  -H "Content-Type: application/json" \
  -d '{"kioskId":"ci-kiosk","displayName":"CI","enrollmentToken":"ci-enroll"}')
KTOK=$(echo "$ENR" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")

KIOSK_ID=ci-kiosk KIOSK_TOKEN="$KTOK" SERVER_URL="$BASE" npx tsx scripts/fake-kiosk.ts > /tmp/ci-fake.log 2>&1 &
FK_PID=$!
sleep 2
echo "kiosks: $(curl -sS "${BASE}/api/kiosks")"

printf '%%PDF-1.4 smoke' > /tmp/ci-doc.pdf
UP=$(curl -sS -X POST "${BASE}/api/upload" -F 'file=@/tmp/ci-doc.pdf;type=application/pdf')
FURL=$(echo "$UP" | python3 -c "import json,sys;print(json.load(sys.stdin)['fileUrl'])")
echo "uploaded: $FURL"

DJ=$(curl -sS -X POST "${BASE}/api/print-job" -H "Content-Type: application/json" \
  -d "{\"kioskId\":\"ci-kiosk\",\"fileUrl\":\"$FURL\",\"copies\":1,\"color\":\"bw\",\"duplex\":false}")
ID=$(echo "$DJ" | python3 -c "import json,sys;print(json.load(sys.stdin)['printJobId'])")
TOK=$(echo "$DJ" | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

STATUS=""
for i in $(seq 1 60); do
  STATUS=$(curl -sS "${BASE}/api/print-job/${ID}" -H "x-print-job-token: ${TOK}" \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['status'])")
  if [ "$STATUS" = "PRINT_SUCCESS" ] || [ "$STATUS" = "ERROR" ] || [ "$STATUS" = "PRINTER_ERROR" ]; then
    break
  fi
  sleep 1
done
echo "final status: $STATUS"
[ "$STATUS" = "PRINT_SUCCESS" ] || { echo "SMOKE FAIL: expected PRINT_SUCCESS"; exit 1; }

echo "offline dispatch: $(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/print-job" \
  -H "Content-Type: application/json" \
  -d "{\"kioskId\":\"ghost\",\"fileUrl\":\"$FURL\",\"copies\":1,\"color\":\"bw\",\"duplex\":false}") (want 503)"
[ "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/print-job" \
  -H "Content-Type: application/json" \
  -d "{\"kioskId\":\"ghost\",\"fileUrl\":\"$FURL\",\"copies\":1,\"color\":\"bw\",\"duplex\":false}")" = "503" ] || exit 1

echo "wrong admin token: $(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/admin/overview" -H "x-admin-token: wrong") (want 401)"
[ "$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/admin/overview" -H "x-admin-token: wrong")" = "401" ] || exit 1

echo "SMOKE PASS"
