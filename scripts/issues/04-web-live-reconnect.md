## Context
Web opens a user-role socket `{ role: "user", printJobId }` and renders `JOB_STATUS` events; status map in `page.tsx:266-274` (`docs/PRD.md §5.4`, `docs/SOCKET_PROTOCOL.md`). Socket disconnect mid-job must show "Live connection lost… tap Send to retry" — no silent stall. Today a kiosk disconnect mid-job leaves the job stuck at last status with no timeout/retry (`docs/ARCHITECTURE.md §6`).

## Scope
- [ ] Web: on socket `disconnect`/`connect_error` mid-job show reconnecting state + "Live connection lost… tap Send to retry".
- [ ] Terminal events (`PRINT_SUCCESS, ERROR, PRINTER_ERROR`) close socket and re-enable Send (already spec'd — verify).
- [ ] Add "Check status" fallback: `GET /api/print-job/:id` with `x-print-job-token` to refresh timeline without resubmitting.
- [ ] Do not auto-resubmit a job on reconnect (avoid double print).

## Acceptance
- [ ] Kill backend socket mid-`PRINTING_STARTED` → UI shows connection-lost state, never an infinite spinner.
- [ ] `QUEUED → … → PRINT_SUCCESS` full sequence visible on online fake-kiosk (`docs/PRD.md §7`).
