## Context
Admin API: `POST /api/admin/kiosks/enroll`, `GET /api/admin/overview`, `PATCH /api/admin/kiosks/:kioskId` — all require `x-admin-token` (`docs/API.md`, `docs/PRD.md §5.7`). `docs/PLAN.md` Phase 2 lists "admin console polish" as remaining.

## Scope
- [ ] Token input (never hardcoded, `docs/GUIDELINES.md`): persisted to localStorage, "check admin token" message on 401 — never a stack trace.
- [ ] Overview view: all known kiosks + online flag + `connectedAt`, recent jobs table (last 100, no tokens/fileUrls — matches API shape).
- [ ] Enroll flow: `kioskId + displayName + enrollmentToken` → shows one-time kiosk `token` with copy button + "save to `.env` as `KIOSK_TOKEN`" hint.
- [ ] Rename flow: `PATCH displayName (1–80 chars)` inline edit.
- [ ] Handle `503 Supabase unconfigured` and `404 kiosk unknown` with human messages.

## Acceptance
- [ ] Wrong `x-admin-token` → 401 on all `/api/admin/*` shown as "check admin token".
- [ ] Enroll → rename → appears in `GET /api/admin/overview` and `GET /api/kiosks` (when online).
