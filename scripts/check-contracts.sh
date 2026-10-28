#!/usr/bin/env bash
# Triple-contract sync check (docs/GUIDELINES.md §8): contracts duplicated,
# not imported. Changing one requires updating all three + docs.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKEND_TYPES=apps/backend/src/types.ts
BACKEND_SOCKET=apps/backend/src/socket.ts
BACKEND_CONFIG=apps/backend/src/config.ts
KIOSK_TYPES=apps/kiosk-client/src/types.ts
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

echo "=== Backend types.ts ==="
check_file_has "$BACKEND_TYPES" \
  QUEUED SENT_TO_KIOSK DOWNLOAD_START DOWNLOAD_COMPLETE PRINTING_STARTED PRINT_SUCCESS ERROR PRINTER_ERROR CANCELLED \
  KIOSK_STATUS_EVENTS NewPrintJobPayload PrintJobStatus KioskStatusPayload PrintJobRecord

echo "=== Backend socket.ts (event strings) ==="
check_file_has "$BACKEND_SOCKET" NEW_PRINT_JOB kiosk_status JOB_STATUS KIOSK_ENROLLED

echo "=== Backend config.ts (room helpers) ==="
check_file_has "$BACKEND_CONFIG" kioskRoom jobRoom

echo "=== Kiosk-client types.ts ==="
check_file_has "$KIOSK_TYPES" KIOSK_STATUS_EVENTS NewPrintJobPayload

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

echo "=== error codes ==="
if ! grep -qF "PRINTER_NO_DEFAULT_DESTINATION" docs/API.md 2>/dev/null; then
  echo "WARNING: docs/API.md may not reference error codes (manual review)"
fi

echo "=== docs references ==="
if [ -f docs/API.md ]; then
  echo "docs/API.md present"
else
  echo "FAIL: docs/API.md missing"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "FAIL: triple-contract out of sync — see docs/GUIDELINES.md."
  exit 1
fi
echo "OK: triple-contract in sync"