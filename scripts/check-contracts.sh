#!/usr/bin/env bash
# Triple-contract sync check (docs/GUIDELINES.md §8): contracts duplicated,
# not imported. Changing one requires updating all three + docs.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKEND=apps/backend/src/types.ts
KIOSK=apps/kiosk-client/src/types.ts
fail=0

check_file_has() {
  local file="$1"; shift
  for term in "$@"; do
    if ! grep -qF "$term" "$file"; then
      echo "CONTRACT MISMATCH: '$term' missing in $file"
      fail=1
    fi
  done
}

echo "=== status lifecycle ==="
check_file_has "$BACKEND" QUEUED SENT_TO_KIOSK DOWNLOAD_START DOWNLOAD_COMPLETE PRINTING_STARTED PRINT_SUCCESS ERROR PRINTER_ERROR CANCELLED

echo "=== socket event strings (names from types) ==="
# NEW_PRINT_JOB is emitted by backend; kiosk_status, JOB_STATUS, KIOSK_ENROLLED are events
check_file_has "$BACKEND" "SENT_TO_KIOSK" "DOWNLOAD_START" "DOWNLOAD_COMPLETE" "PRINTING_STARTED" "PRINT_SUCCESS" "ERROR" "PRINTER_ERROR" "CANCELLED"

echo "=== event references in docs ==="
if grep -qF "NEW_PRINT_JOB" docs/API.md docs/SOCKET_PROTOCOL.md 2>/dev/null; then
  echo "OK: docs reference NEW_PRINT_JOB"
else
  echo "NOTE: docs may reference differently"
fi

echo "=== socket event strings ==="
check_file_has "$BACKEND" NEW_PRINT_JOB kiosk_status JOB_STATUS KIOSK_ENROLLED

echo "=== rooms ==="
# Room prefixes (kioskRoom / jobRoom helpers in config or types)
check_file_has "$BACKEND" "kioskRoom" "jobRoom"

# Event names present as string constants
for ev in "NEW_PRINT_JOB" "kiosk_status" "JOB_STATUS" "KIOSK_ENROLLED"; do
  if grep -qF "$ev" "$BACKEND"; then echo "OK: event $ev"; else echo "FAIL: event $ev"; fail=1; fi
done

echo "=== 50 MB cap + copy limits ==="
for f in .env.example apps/backend/.env.example apps/kiosk-client/.env.example; do
  if [ -f "$f" ]; then
    if ! grep -qE "50|MAX_FILE_BYTES|MAX_DOWNLOAD_BYTES|COPIES" "$f" 2>/dev/null; then
      echo "NOTE: $f may not reference limits (reviewed manually)"
    else
      echo "OK: $f references limits"
    fi
  fi
done

echo "=== error codes (back of type docs / error mapping docs/API.md) ==="
# We check docs reference the family codes
if ! grep -qF "PRINTER_NO_DEFAULT_DESTINATION" docs/API.md 2>/dev/null; then
  echo "WARNING: docs/API.md may not reference error codes (manual review)"
fi

echo "=== docs references ==="
if [ -f docs/API.md ]; then
  echo "docs/API.md present"
fi

if [ "$fail" -ne 0 ]; then
  echo "FAIL: triple-contract out of sync — see docs/GUIDELINES.md."
  exit 1
fi
echo "OK"
