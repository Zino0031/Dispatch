#!/usr/bin/env bash
# Daily pilot snapshot (issue #16): saves the admin overview and prints the
# running success rate. Requires BACKEND_URL and ADMIN_TOKEN.
# Usage: BACKEND_URL=https://backend:4000 ADMIN_TOKEN=... bash scripts/pilot-snapshot.sh
set -euo pipefail
: "${BACKEND_URL:?set BACKEND_URL}"
: "${ADMIN_TOKEN:?set ADMIN_TOKEN}"

OUT="pilot-data/$(date +%F).json"
mkdir -p pilot-data
curl -sS -f "${BACKEND_URL}/api/admin/overview" -H "x-admin-token: ${ADMIN_TOKEN}" -o "$OUT"
echo "saved $OUT"
python3 - "$OUT" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
jobs = d.get("jobs", [])
terminal = [j for j in jobs if j["status"] in ("PRINT_SUCCESS", "ERROR", "PRINTER_ERROR", "CANCELLED")]
ok = sum(1 for j in jobs if j["status"] == "PRINT_SUCCESS")
rate = (ok / len(terminal) * 100) if terminal else 0.0
print(f"jobs={len(jobs)} terminal={len(terminal)} PRINT_SUCCESS={ok} rate={rate:.1f}% (target 95%)")
print(f"kiosksOnline={d['summary']['kiosksOnline']} jobsActive={d['summary']['jobsActive']}")
EOF
