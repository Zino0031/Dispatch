## Context — SECURITY
Live `JOB_STATUS` channel requires only `printJobId` (demo convenience; tighten before production — `docs/ARCHITECTURE.md §5`). REST `GET /print-job/:id` already requires `x-print-job-token` (`docs/API.md`). `docs/PLAN.md` Phase 4.4.

## Scope
- [ ] Require `accessToken` on user sockets: `io(..., { auth: { role: "user", printJobId, token } })`; missing/wrong → `connect_error`.
- [ ] Web sends the `accessToken` from `POST /api/print-job` response over the socket auth (never in URL/logs).
- [ ] Backend middleware verifies token with `timingSafeEqual`-style compare; never log tokens (`docs/GUIDELINES.md`).
- [ ] Update `docs/SOCKET_PROTOCOL.md` in the same change.

## Acceptance
- [ ] Socket with `printJobId` alone → `connect_error`; with correct token → timeline streams.
- [ ] Wrong-token negatives covered (401/404/connect_error per `docs/GUIDELINES.md` verification).
