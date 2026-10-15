## Context
`GET /health` returns `{ ok, onlineKiosks }` and `/health/supabase` checks Supabase (`docs/API.md`). `docs/PLAN.md` Phase 4 wants `/health` with CUPS + disk checks on the kiosk.

## Scope
- [ ] Kiosk: local health endpoint or `npm run health` CLI: CUPS reachable, default destination set, LibreOffice present, `TEMP_DIR` writable + free space.
- [ ] Backend `/health`: keep lightweight; document kiosk health separately (do not block backend on CUPS).
- [ ] Operator runbook update in `docs/OPERATIONS.md` (stuck `PRINTING_STARTED`, `PRINTER_NO_DEFAULT_DESTINATION`).

## Acceptance
- [ ] Unplugged printer / no default destination → health check names it in one command.
