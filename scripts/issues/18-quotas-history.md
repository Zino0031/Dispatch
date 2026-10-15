## Context
Non-goal in v1: user accounts, quotas, print history across sessions (`docs/PRD.md §3`). `docs/PLAN.md` Phase 5: user quotas.

## Scope
- [ ] Decide identity (campus SSO / phone code / none) + quota model (pages/semester, guest cap).
- [ ] Persist per-user jobs (depends on JobStore persistence) + history view.
- [ ] Enforce quota at `POST /api/print-job` with 402/429 + web messaging.

## Acceptance
- [ ] Over-quota user gets a clear pre-payment block; history shows past jobs + statuses.
