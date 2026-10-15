## Context
`JobStore` is in-memory only — jobs vanish on backend restart (`docs/PRD.md §3`, `docs/ARCHITECTURE.md`). `GET /api/admin/overview` jobs list is empty after restart (documents ephemeral nature). `docs/PLAN.md` Phase 4.1: move to Supabase/Postgres or document "ephemeral by design" for pilot. Related risk `docs/PRD.md §8.2`.

## Scope
- [ ] Decide: (a) Supabase/Postgres-backed `JobStore` (+ migration for jobs + history), or (b) written pilot waiver "ephemeral by design".
- [ ] If (a): persist `PrintJobRecord + history + lastError`, keep `accessToken` hashed or access-controlled, keep API token-gating semantics (`404`, no id oracle).
- [ ] Migration + rollback tested; `uploads/` path or storage-bucket reference stored per job.
- [ ] Update `docs/ARCHITECTURE.md` + `docs/API.md` in the same change (`docs/GUIDELINES.md`).

## Acceptance
- [ ] Backend restart → `GET /api/admin/overview` jobs list survives (or waiver doc merged explicitly for pilot).
