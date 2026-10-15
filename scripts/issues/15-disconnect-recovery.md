## Context
Kiosk disconnects mid-job → no timeout/retry; job stuck at last status (`docs/ARCHITECTURE.md §6`). Web only shows "Live connection lost" on socket drop. Backend owns REST + Socket.io in one process; kiosks reconnect via `reconnection: true` but jobs do not recover (`docs/ARCHITECTURE.md §7`).

## Scope
- [ ] Backend: heartbeat/job watchdog — mark jobs stuck in `DOWNLOAD_*/PRINTING_STARTED` past N min as `ERROR`/`PRINTER_ERROR` with `OPERATION_TIMEOUT`-style code + notify `job:{id}` room.
- [ ] Kiosk: on reconnect, report `activeJob` state or re-emit last status so backend can reconcile (no duplicate prints).
- [ ] Web: "printer disconnected, job may be interrupted — check with staff / resend" state distinct from terminal `ERROR`.
- [ ] Runbook in `docs/OPERATIONS.md` (kiosk offline 503 path already exists — extend to mid-job).

## Acceptance
- [ ] Kill kiosk mid-`PRINTING_STARTED` → job reaches a terminal/explained state within timeout; web never spins forever.
