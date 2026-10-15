# Plan — Phased Delivery

## Phase 1 — Backend API ✅ DONE
- [x] Express + Socket.io bootstrap, CORS (allowlist + LAN), `/health`, `/health/supabase`
- [x] `POST /api/upload` (multer 50 MB, uuid filenames), `GET /api/kiosks` (online only)
- [x] `POST /api/print-job` (zod, 503 when offline), `GET /api/print-job/:id` (token-gated)
- [x] Kiosk auth (scrypt), auto-enroll + `KIOSK_ENROLLED`, admin enroll/rename/overview
- [x] `fake-kiosk` simulator script
- **Exit:** `npm run build` passes; dispatch works with and without a kiosk (201 / 503).

## Phase 2 — Web user UI �framing_intentional: IN PROGRESS (functional, needs hardening)
- [x] 6-step wizard, presets, kiosk cards, review (PDF iframe / mammoth DOCX / image), test checkout, live timeline
- [x] Copy mode: capture → rotate → auto-crop → filter → A4 fit → DPI hint → JPEG → print
- [ ] Remaining: empty-state copy, upload retry, 503-specific messaging, admin console polish
- [ ] Load `web-design-guidelines` skill before any UI change
- **Exit:** `npm run lint` + `npm run build` pass; full pass works offline-gracefully and online-live.

## Phase 3 — Kiosk client �framing_intentional: IN PROGRESS (functional, needs field hardening)
- [x] Socket connect/reconnect, `KIOSK_ENROLLED` persistence, single-job guard, download → normalize → CUPS → status → cleanup
- [ ] Remaining: systemd unit + auto-restart, CUPS/LibreOffice provision script, disk-space guard, log rotation
- **Exit:** fresh Mini PC prints PDF + JPG + DOCX end-to-end after following `docs/OPERATIONS.md` once.

## Phase 4 — Hardening & pilot (NEXT)
1. **Persistence:** move `JobStore` to Supabase/Postgres (or document "ephemeral by design" for pilot).
2. **Uploads:** signed URLs or token-gated proxy + retention sweeper honoring `PRINT_DOCUMENT_RETENTION_HOURS`.
3. **Queueing:** decide FIFO-per-kiosk vs. reject-busy; implement chosen semantics + web "position in queue" UI.
4. **Realtime auth:** require `accessToken` on user sockets, not just `printJobId`.
5. **Observability:** structured logs (jobId/kioskId on every line), `/health` with CUPS + disk checks on kiosk.
6. **Pilot checklist:** 1 backend + 1 web deployment + 2 kiosks in one library for 2 weeks; success = 95% `PRINT_SUCCESS`, median upload→collect < 2 min.

## Phase 5 — Production (LATER)
Real payments, user quotas, multi-printer-per-kiosk routing, fleet dashboard metrics, CI (build+lint+smoke per app).

## Milestone tracking
Update the checkboxes in this file as phases complete. Do not mark a phase done until its Exit criteria are verified with the commands in `AGENTS.md §5`.
