## Context
Current: one active job per kiosk; extras rejected with `ERROR "Kiosk is already processing another job"` (`docs/ARCHITECTURE.md §6`, `docs/SOCKET_PROTOCOL.md`). `docs/PRD.md §8.4`: decide FIFO queue vs reject-busy. `docs/PLAN.md` Phase 4.3: implement chosen semantics + web "position in queue" UI. Changing this must also change the busy-`ERROR` contract + web messaging (`docs/GUIDELINES.md`).

## Scope
- [ ] Decision recorded (FIFO-per-kiosk vs reject-busy) with capacity bound + cancellation story (`CANCELLED` is typed but has no writer — `docs/ARCHITECTURE.md §4`).
- [ ] Backend: per-kiosk queue + `position` in `GET /api/print-job/:id` + `JOB_STATUS` payload or new `QUEUE_POSITION` event.
- [ ] Kiosk: sequential `processJob` unchanged (pull next on `PRINT_SUCCESS/ERROR`), single-job guard preserved internally.
- [ ] Web: "position in queue (#2)" UI + cancel button if `CANCELLED` is implemented.

## Acceptance
- [ ] 2 rapid dispatches to same busy kiosk → defined behavior (queued #2 OR clean reject) + UI shows it; no silent drop.
