## Context
Upload is validated twice and must stay in sync: client `validateFile()` and server multer 50 MB cap (`docs/PRD.md §5.1`). Dispatch to an offline kiosk returns `503 { error: "Kiosk offline" }` (`docs/API.md`). Web must surface this, not hang. `docs/PLAN.md` Phase 2 lists "upload retry, 503-specific messaging" as remaining.

## Scope
- [ ] Client-side: 51 MB file rejected with clear message; `.exe` rejected with "That file type isn't supported…".
- [ ] Server-side: confirm multer 50 MB + mimetype rejects map to `400 { error }` surfaced in UI.
- [ ] Upload failure shows retry button preserving selected file/options.
- [ ] `503 Kiosk offline` at `POST /api/print-job` shows "printer went offline, pick another / retry" — not a spinner stall.
- [ ] Keep triple contract in sync (50 MB in multer ↔ `MAX_FILE_BYTES` ↔ downloader caps).

## Acceptance (from `docs/PRD.md §7`)
- [ ] 51 MB file rejected client-side AND server-side (400).
- [ ] `.exe` rejected with supported-type message.
- [ ] Offline kiosk → 503, web shows actionable error.
