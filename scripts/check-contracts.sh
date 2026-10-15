#!/usr/bin/env bash
# Triple-contract sync check (issue #22).
# Contracts are duplicated, not imported: backend is the authority, web and
# kiosk-client are followers (docs/PROJECT_STRUCTURE.md). Any change to status
# strings, event names, room prefixes or the 50 MB limit must land in all three
# apps + docs/API.md + docs/SOCKET_PROTOCOL.md. This script fails CI otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKEND=apps/backend/src/contracts.ts
WEB=apps/web/lib/contracts.ts
KIOSK=apps/kiosk-client/src/contracts.ts
fail=0

check_each_contains() {
  local label="$1"; shift
  local files=("$BACKEND" "$WEB" "$KIOSK")
  for value in "$@"; do
    for f in "${files[@]}"; do
      if ! grep -qF "$value" "$f"; then
        echo "CONTRACT MISMATCH [$label]: '$value' missing in $f"
        fail=1
      fi
    done
  done
}

echo "== status strings =="
check_each_contains "status" QUEUED SENT_TO_KIOSK DOWNLOAD_START DOWNLOAD_COMPLETE PRINTING_STARTED PRINT_SUCCESS ERROR PRINTER_ERROR CANCELLED

echo "== socket events =="
check_each_contains "event" '"NEW_PRINT_JOB"' '"kiosk_status"' '"JOB_STATUS"' '"KIOSK_ENROLLED"'

echo "== room prefixes =="
check_each_contains "room" 'kiosk:' 'job:'

echo "== 50 MB caps =="
for f in "$BACKEND" "$WEB" "$KIOSK"; do
  if ! grep -qE "50 \* 1024 \* 1024|52428800|50 MB" "$f"; then
    echo "CONTRACT MISMATCH [limit]: 50 MB marker missing in $f"
    fail=1
  fi
done

echo "== error codes (backend authority) =="
for code in PRINTER_NO_DEFAULT_DESTINATION DOCUMENT_DOWNLOAD_FAILED DOCUMENT_CONVERSION_FAILED OPERATION_TIMEOUT PRINTER_COMMAND_FAILED KIOSK_JOB_ERROR; do
  if ! grep -qF "$code" "$BACKEND"; then
    echo "CONTRACT MISMATCH [error-code]: '$code' missing in $BACKEND"
    fail=1
  fi
done

echo "== docs references =="
if ! grep -qE "PRINT_SUCCESS|PRINTER_ERROR" docs/API.md; then
  echo "CONTRACT MISMATCH [docs]: status names missing in docs/API.md"
  fail=1
fi
for doc in docs/SOCKET_PROTOCOL.md docs/ARCHITECTURE.md; do
  if ! grep -qE "NEW_PRINT_JOB|kiosk_status|JOB_STATUS" "$doc"; then
    echo "CONTRACT MISMATCH [docs]: event names missing in $doc"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "FAIL: triple-contract out of sync — update all three apps + docs (see docs/PROJECT_STRUCTURE.md)."
  exit 1
fi
echo "OK: triple-contract in sync."
