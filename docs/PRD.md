# PRD — Automated Self-Service Printing Kiosk

**Version:** 1.0 · **Date:** 2026-10-15 · **Status:** Phase 1 live (backend), Phase 2–4 in progress
**Owner:** University campus print service · **Audience:** builders, operators, agents

## 1. Problem

Students need to print PDFs, phone photos of documents, and Word files from their own
devices without USB sticks, logins on lab PCs, or staff help. Existing lab printing is
tied to desktop sessions and fails when labs are closed.

## 2. Goals

1. Phone-to-printer in under 2 minutes: upload → pick kiosk → pay (test) → live status → collect.
2. Thin-client kiosks: a cheap Mini PC + USB printer per location, zero inbound ports.
3. Operator visibility: which kiosks are online, which jobs succeeded/failed and why.
4. Safe defaults: 50 MB cap, authenticated kiosks, per-job access tokens, temp-file cleanup.

## 3. Non-goals (v1)

- Real payment processing (current checkout is a simulated `tapTest()` in `apps/web/app/page.tsx:647-656`).
- User accounts, quotas, or print history across sessions.
- Multi-job queueing per kiosk (current: **one active job**, extras rejected with `ERROR`).
- Durable job persistence (current `JobStore` is **in-memory only** — jobs vanish on backend restart).
- Automatic document retention enforcement (config `PRINT_DOCUMENT_RETENTION_HOURS` exists but no sweeper ships yet).

## 4. Users

| User | Needs | Entry point |
|---|---|---|
| Student | Print PDF/photo/DOCX fast, see live progress, know price up front | `apps/web` wizard (mobile-first) |
| Kiosk (machine) | Poll-free job delivery, download + print + report status, survive reconnects | `apps/kiosk-client` daemon |
| Operator/admin | Enroll kiosks, rename locations, see fleet + recent jobs | `apps/web/app/admin` + `GET /api/admin/overview` |

## 5. Functional requirements

### 5.1 Upload (web → backend)
- Accept `PDF, JPG, JPEG, PNG, DOC, DOCX`, max 50 MB, reject empty files.
- Implemented twice and must stay in sync: client check `validateFile()` (`page.tsx:51-57`)
  and server check multer `allowedMimeTypes` + `fileSize: 50MB` (`routes/printJob.ts:13-40`).
- Response: `{ fileUrl, fileName, mimeType, size }`, file served from `/uploads/<uuid>.<ext>`.

### 5.2 Kiosk selection
- `GET /api/kiosks` returns **online-only** kiosks (`kioskStatuses().filter(online)`).
- Web auto-selects first online kiosk; wizard blocks Options→Review when none selected.

### 5.3 Job creation
- `POST /api/print-job { kioskId, fileUrl, copies 1–50, color bw|color, duplex bool }` (zod-validated).
- `503 { error: "Kiosk offline" }` when target kiosk has no live socket — web must surface this, not hang.
- `201 { printJobId (uuid), accessToken (24-byte hex), status: QUEUED→SENT_TO_KIOSK }`.

### 5.4 Live tracking
- Web opens a **user-role socket** `{ role: "user", printJobId }` and renders `JOB_STATUS` events.
- Status map (`page.tsx:266-274`): `SENT_TO_KIOSK, DOWNLOAD_START, DOWNLOAD_COMPLETE → step 2`;
  `PRINTING_STARTED → step 3`; `PRINT_SUCCESS → step 4 (done)`; `ERROR/PRINTER_ERROR → error label`.
- Socket disconnect mid-job shows "Live connection lost… tap Send to retry" (no silent stall).

### 5.5 Kiosk execution (must sequence)
1. `DOWNLOAD_START` → fetch `fileUrl` (HTTP/S only, `redirect: "error"`, size + timeout caps).
2. `DOWNLOAD_COMPLETE` → if DOC/DOCX, convert via headless LibreOffice; otherwise print as-is.
3. `PRINTING_STARTED` → require CUPS default destination → `lp -t "Print Kiosk <id>" -n <copies> [-o sides=two-sided-long-edge] <file>`.
4. Poll `lpstat` up to 30 s; on success `PRINT_SUCCESS`, else `PRINTER_ERROR` / `ERROR` with message.
5. Always delete temp files (`finally` in `kiosk-client/src/index.ts:104-111`).

### 5.6 Copy mode (phone-as-scanner)
- Capture photo → rotate → auto-detect page quad (`detectDocument`) → warp (`warpQuad`) →
  filter (Enhance/B&W/Gray/Color) → fit on A4 (Fill/Fit/True-size + DPI sharpness hint) → `canvas.toBlob` JPEG → becomes the print `File`.
- Manual corner adjust with draggable handles; auto-crop toggle; retake always available.

### 5.7 Admin
- `POST /api/admin/kiosks/enroll { kioskId, displayName, enrollmentToken }` → returns one-time `token` (requires `x-admin-token`, correct `KIOSK_ENROLLMENT_TOKEN`, Supabase configured).
- `GET /api/admin/overview` → `{ kiosks (all known + online flag), jobs (last 100, tokens+fileUrls stripped), summary }`.
- `PATCH /api/admin/kiosks/:kioskId { displayName }` → rename location.

## 6. Pricing (test)

`UNIT_PRICE = { bw: 5, color: 20 }`, `total = copies × unit`. Duplex does not change price in v1.
Checkout is a 1.2 s fake processor (`tapTest`); do not present it as a real charge.

## 7. Acceptance criteria

- [ ] Offline kiosk → `POST /api/print-job` returns 503, web shows actionable error.
- [ ] Online fake-kiosk → full `QUEUED→…→PRINT_SUCCESS` visible in web timeline.
- [ ] 51 MB file rejected client-side AND server-side (400).
- [ ] `.exe` rejected with "That file type isn't supported…".
- [ ] Kiosk processes exactly one job at a time; second concurrent job gets `ERROR`.
- [ ] Temp dir empty after success and after failure.
- [ ] Wrong `x-admin-token` → 401 on all `/api/admin/*`.
- [ ] Backend restart → `/api/admin/overview` jobs list is empty (documents ephemeral nature; upgrade only via planned persistence work).

## 8. Open risks / decisions needed

1. Real payments provider + per-page pricing (currently per-copy flat test price).
2. Job durability: move `JobStore` to Supabase/Postgres before any SLA.
3. `uploads/` is statically served with no auth — needs signed URLs or same-origin proxy + retention sweeper.
4. No per-kiosk queue: decide FIFO queue vs. reject-busy (current = reject-busy).
