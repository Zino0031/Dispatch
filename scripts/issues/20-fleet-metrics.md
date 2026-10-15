## Context
Operator visibility: which kiosks are online, which jobs succeeded/failed and why (`docs/PRD.md §2`). Today only `GET /api/admin/overview` (last 100, stripped) + basic admin console. `docs/PLAN.md` Phase 5: fleet dashboard metrics.

## Scope
- [ ] Metrics: success rate, `PRINTER_*` vs `DOCUMENT_*` breakdown, median upload→`PRINT_SUCCESS`, per-kiosk online %.
- [ ] Time window + CSV export for staff; link from job row to redacted history.
- [ ] Keep token/fileUrl stripping in overview responses (`docs/API.md`).

## Acceptance
- [ ] Operator answers "which kiosk fails most and why" in < 1 min from the dashboard.
