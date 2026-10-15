#!/usr/bin/env bash
# Fail when .env.example files are missing or lack required keys (issue #21).
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0
need() {
  local file="$1"; shift
  if [ ! -f "$file" ]; then echo "MISSING: $file"; fail=1; return; fi
  for key in "$@"; do
    if ! grep -q "^${key}=" "$file"; then echo "MISSING KEY ${key} in $file"; fail=1; fi
  done
}
need apps/backend/.env.example PORT PUBLIC_URL CORS_ORIGIN ADMIN_TOKEN KIOSK_ENROLLMENT_TOKEN AUTO_ENROLL_KIOSKS SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY PRINT_DOCUMENT_RETENTION_HOURS
need apps/kiosk-client/.env.example SERVER_URL KIOSK_ID KIOSK_TOKEN KIOSK_TOKEN_FILE TEMP_DIR MAX_DOWNLOAD_BYTES DOWNLOAD_TIMEOUT_MS
# Real secrets must never be committed.
for f in $(git ls-files | grep -E '(\.env$|\.kiosk-token$)' || true); do
  echo "LEAKED SECRET FILE COMMITTED: $f"; fail=1
done
[ "$fail" -eq 0 ] && echo "ENV EXAMPLES OK"
exit "$fail"
