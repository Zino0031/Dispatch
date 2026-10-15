#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
REPO="Zino0031/Dispatch"

# Create labels (idempotent)
gh label create "phase-2-web" --color "0E8A16" --description "Phase 2 Web UI" --repo "$REPO" 2>/dev/null || true
gh label create "phase-3-kiosk" --color "1D76DB" --description "Phase 3 Kiosk client" --repo "$REPO" 2>/dev/null || true
gh label create "phase-4-hardening" --color "D93F0B" --description "Phase 4 Hardening and pilot" --repo "$REPO" 2>/dev/null || true
gh label create "phase-5-production" --color "5319E7" --description "Phase 5 Production" --repo "$REPO" 2>/dev/null || true
gh label create "type-security" --color "B60205" --description "Security gap" --repo "$REPO" 2>/dev/null || true
gh label create "type-ops" --color "FEF2C0" --description "Operations" --repo "$REPO" 2>/dev/null || true
gh label create "type-feature" --color "A2EEEF" --description "Feature" --repo "$REPO" 2>/dev/null || true
gh label create "type-bug" --color "D73A4A" --description "Bug / hardening" --repo "$REPO" 2>/dev/null || true

create_issue() {
  local title="$1"; local label="$2"; local bodyfile="$3"
  echo "=> $title"
  gh issue create --repo "$REPO" --title "$title" --label "$label" --body-file "$bodyfile"
}

DIR="$(cd "$(dirname "$0")" && pwd)/issues"
create_issue "[Phase 2] Web empty-state when no kiosks online" "phase-2-web" "$DIR/01-web-empty-state.md"
create_issue "[Phase 2] Upload retry + 503 Kiosk-offline messaging" "phase-2-web" "$DIR/02-web-upload-retry-503.md"
create_issue "[Phase 2] Admin console polish (token UX + overview)" "phase-2-web" "$DIR/03-web-admin-polish.md"
create_issue "[Phase 2] Harden live-tracking reconnect (no silent stall)" "phase-2-web" "$DIR/04-web-live-reconnect.md"
create_issue "[Phase 3] systemd unit + auto-restart for kiosk-client" "phase-3-kiosk" "$DIR/05-kiosk-systemd.md"
create_issue "[Phase 3] CUPS + LibreOffice provision script" "phase-3-kiosk" "$DIR/06-kiosk-provision.md"
create_issue "[Phase 3] Disk-space guard + log rotation (kiosk + backend)" "phase-3-kiosk" "$DIR/07-kiosk-disk-logs.md"
create_issue "[Phase 3] Kiosk health checks (CUPS + disk)" "phase-3-kiosk" "$DIR/08-kiosk-health.md"
create_issue "[Phase 4] Persist JobStore to Supabase/Postgres" "phase-4-hardening" "$DIR/09-persist-jobstore.md"
create_issue "[Phase 4] Secure uploads: signed URLs or token-gated proxy" "type-security" "$DIR/10-uploads-auth.md"
create_issue "[Phase 4] Upload retention sweeper (PRINT_DOCUMENT_RETENTION_HOURS)" "phase-4-hardening" "$DIR/11-retention-sweeper.md"
create_issue "[Phase 4] Per-kiosk queue: FIFO vs reject-busy decision + UI" "phase-4-hardening" "$DIR/12-queueing.md"
create_issue "[Phase 4] Require accessToken on user sockets" "type-security" "$DIR/13-socket-auth.md"
create_issue "[Phase 4] Structured logs (jobId/kioskId everywhere, no tokens)" "phase-4-hardening" "$DIR/14-observability.md"
create_issue "[Phase 4] Mid-job disconnect timeout + recovery" "phase-4-hardening" "$DIR/15-disconnect-recovery.md"
create_issue "[Phase 4] Pilot checklist: 1 backend + 1 web + 2 kiosks, 2 weeks" "phase-4-hardening" "$DIR/16-pilot.md"
create_issue "[Phase 5] Real payments + per-page pricing" "phase-5-production" "$DIR/17-payments.md"
create_issue "[Phase 5] User quotas + print history" "phase-5-production" "$DIR/18-quotas-history.md"
create_issue "[Phase 5] Multi-printer-per-kiosk routing" "phase-5-production" "$DIR/19-multi-printer.md"
create_issue "[Phase 5] Fleet dashboard metrics" "phase-5-production" "$DIR/20-fleet-metrics.md"
create_issue "[Phase 5] CI: build + lint + smoke per app" "phase-5-production" "$DIR/21-ci.md"
create_issue "[Repo] Commit apps/* + docs/* and enforce triple-contract sync" "type-ops" "$DIR/22-repo-contract.md"
echo "Done: 22 issues created."
