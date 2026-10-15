## Context
`GET /api/kiosks` returns online-only kiosks (`docs/API.md`, `docs/PRD.md §5.2`). Web auto-selects the first online kiosk, and the wizard blocks Options → Review when none is selected. There is no helpful empty-state copy.

Refs: `docs/PLAN.md` Phase 2 remaining, `docs/PRD.md §5.2`, `apps/web/app/page.tsx` wizard.

## Scope
- [ ] Add empty-state card when kiosk list is empty: "No printers online right now", nearest location hint, retry button.
- [ ] Disable/block Review step with actionable message (not a dead Next button).
- [ ] Auto-refresh kiosk list (poll or refetch on focus) so recovery is visible without reload.
- [ ] Load `web-design-guidelines` skill before any UI change (`docs/GUIDELINES.md`).

## Acceptance
- [ ] With backend up and no kiosk connected, user sees empty-state + retry.
- [ ] Connecting `fake-kiosk` makes the kiosk appear without full page reload.
- [ ] `npm run lint` + `npm run build` pass in `apps/web`.
