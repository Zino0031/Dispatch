## Context
`docs/PLAN.md` Phase 4.6 pilot: 1 backend + 1 web deployment + 2 kiosks in one library for 2 weeks; success = 95% `PRINT_SUCCESS`, median upload → collect < 2 min.

## Scope
- [ ] Deploy backend + web (record URLs, `CORS_ORIGIN`, `PUBLIC_URL` reachable by kiosks).
- [ ] Enroll 2 kiosks via admin API (or auto-enroll then disable `AUTO_ENROLL_KIOSKS`).
- [ ] Instrument: `GET /api/admin/overview` snapshots daily; count `PRINT_SUCCESS / (total terminal)`; measure upload→collect median.
- [ ] Staff one-pager: 503 offline, `PRINTER_NO_DEFAULT_DESTINATION`, stuck `PRINTING_STARTED`, bad-upload 400 (`docs/OPERATIONS.md` runbooks).
- [ ] Go/no-go note at week 2 with numbers.

## Acceptance
- [ ] 95% `PRINT_SUCCESS`, median upload → collect < 2 min, or blocking issues filed with logs.
