## Context
Provisioning today is manual: install Node 22+, CUPS (`lp, lpstat, cancel`), LibreOffice, set CUPS default destination (`docs/OPERATIONS.md`). `docs/PLAN.md` Phase 3 requires a provision script.

## Scope
- [ ] Add `apps/kiosk-client/scripts/provision.sh` (Ubuntu/Debian): Node 22, `cups`, `libreoffice --headless`, add user to `lpadmin`, set default via `lpadmin -d <printer>`, print test page.
- [ ] Script is idempotent + prints versions at end; fails loudly if no default destination (`PRINTER_NO_DEFAULT_DESTINATION` runbook).
- [ ] Update `docs/OPERATIONS.md` to call the script as step 1.

## Acceptance
- [ ] Clean Ubuntu 24.04 VM + script + `docs/OPERATIONS.md` steps → `lpstat -d` shows a default and a test print succeeds.
