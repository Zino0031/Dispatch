#!/usr/bin/env bash
# Provision a Mini PC kiosk (Ubuntu/Debian) — issue #6.
# Installs Node 22, CUPS (+ client tools) and headless LibreOffice for DOC/DOCX,
# then requires a CUPS default destination. Idempotent: safe to re-run.
# Usage: sudo bash apps/kiosk-client/scripts/provision.sh [default-printer]
# Full LibreOffice suite instead of Writer-only: apt install libreoffice
set -euo pipefail

PRINTER="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0 [default-printer]" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends curl ca-certificates gnupg

# Node 22 (skip if already >= 22).
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] 2>/dev/null; then
  echo "node already >= 22: $(node --version)"
else
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi

# CUPS + LibreOffice Writer (headless DOC/DOCX -> PDF).
apt-get install -y --no-install-recommends cups cups-client libreoffice-writer
systemctl enable --now cups || service cups start

# Operator group for USB printer admin.
KIOSK_USER="${SUDO_USER:-$USER}"
if [ "$KIOSK_USER" != "root" ]; then
  usermod -aG lpadmin "$KIOSK_USER" || true
fi

# Default destination (required — PRINTER_NO_DEFAULT_DESTINATION otherwise).
if [ -n "$PRINTER" ]; then
  lpadmin -d "$PRINTER"
fi

echo "--- versions ---"
node --version
lpstat -v || true
soffice --version || libreoffice --version

echo "--- default destination ---"
if lpstat -d; then
  echo "OK: CUPS default destination is set."
else
  echo "FAIL: no CUPS default destination. Run: lpadmin -d <printer> (see docs/OPERATIONS.md)." >&2
  exit 1
fi
