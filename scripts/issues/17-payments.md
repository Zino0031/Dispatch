## Context
Pricing is test-only: `UNIT_PRICE = { bw: 5, color: 20 }`, `total = copies × unit`; checkout is a 1.2 s fake `tapTest()` — do not present as a real charge (`docs/PRD.md §6`, `page.tsx:647-656`). Open risk `docs/PRD.md §8.1`: real payments provider + per-page pricing. `docs/PLAN.md` Phase 5.

## Scope
- [ ] Choose provider (campus card / Stripe / cash-code) + per-page (not per-copy flat) pricing incl. duplex rule.
- [ ] Server-side price quote + payment intent before `POST /api/print-job` creates a job (never trust client total).
- [ ] Web checkout labeled "Test" until gateway lands (`docs/GUIDELINES.md`); receipts with jobId.
- [ ] Refund/void path for `ERROR`/`PRINTER_ERROR` after charge.

## Acceptance
- [ ] No job prints without confirmed payment intent; failed prints void/refund automatically or via admin action.
