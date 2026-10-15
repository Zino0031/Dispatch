## Context
`docs/PLAN.md` Phase 5: multi-printer-per-kiosk routing. Today `printer.ts` requires a single CUPS default destination (`docs/GUIDELINES.md`, `docs/PRD.md §5.5`).

## Scope
- [ ] Model: kiosk → printers[] (name, capabilities color/duplex/A3, default).
- [ ] Dispatch selects printer by job options; `lp -d <printer>` instead of default-only.
- [ ] Admin CRUD for printers per kiosk + web "printer A/B" picker if useful.
- [ ] `PRINTER_NO_DEFAULT_DESTINATION` becomes per-printer offline handling.

## Acceptance
- [ ] Kiosk with 2 CUPS destinations routes bw → printer A, color → printer B per options.
