## Context
This repo currently contains only `README.md` + untracked `docs/` — `apps/{backend,web,kiosk-client}` from `docs/PROJECT_STRUCTURE.md` are not committed. Contracts are duplicated, not imported: `KIOSK_STATUS_EVENTS`, job payloads, 50 MB limit exist in all three apps — change one → change all three + `docs/API.md` + `docs/SOCKET_PROTOCOL.md` (`docs/PROJECT_STRUCTURE.md`, `docs/GUIDELINES.md`).

## Scope
- [ ] Commit `docs/` + `apps/*` (with `.env.example`, never `.env`/`.kiosk-token`/`uploads/`/`temp/`), or record where canonical code lives if this repo is docs-only.
- [ ] Add contract-sync check: status strings (`types.ts` ↔ kiosk `types.ts` ↔ web `statusMap`), 50 MB caps, event names — script or CI grep.
- [ ] Backend is authority on status strings + room names (`kiosk:{id}`, `job:{id}` — `docs/ARCHITECTURE.md §3`); web/kiosk are followers.
- [ ] Update `docs/PLAN.md` checkboxes as phases complete (do not mark done until exit criteria verified).

## Acceptance
- [ ] Fresh clone + `docs/OPERATIONS.md` provisions a printing kiosk; `npm run build` passes per app.
- [ ] Renaming a status/event in one app fails CI until all three + docs agree.
