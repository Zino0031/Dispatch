## Context
`docs/GUIDELINES.md`: log with context — always include `kioskId` + `printJobId` where available, never log tokens. `docs/PLAN.md` Phase 4.5: structured logs + `/health` with CUPS + disk checks on kiosk.

## Scope
- [ ] Backend: JSON/structured logs with `jobId/kioskId/event` on every line (pino or equivalent); `GET /health` stays lightweight.
- [ ] Kiosk: same jobId correlation from `NEW_PRINT_JOB` through `kiosk_status` emissions; include CUPS request id in print-phase logs.
- [ ] Redaction test: `token`, `accessToken`, `KIOSK_TOKEN` never appear in logs.
- [ ] Document log access in `docs/OPERATIONS.md` (journalctl / file paths).

## Acceptance
- [ ] `POST /api/print-job` → full `DOWNLOAD_START…PRINT_SUCCESS` trace greppable by single `printJobId` across backend + kiosk logs.
