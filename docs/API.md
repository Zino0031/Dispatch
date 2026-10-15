# REST API Contract

Base URL: `PUBLIC_URL` (dev `http://localhost:4000`). JSON limit `1mb`, except multipart upload.

## Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | none | `{ ok: true, onlineKiosks: number }` |
| GET | `/health/supabase` | none | Supabase connectivity object (see `src/supabase.ts`) |

## Upload a document

`POST /api/upload` — `Content-Type: multipart/form-data`, field `file`.

- Accepted mimetypes: `application/pdf, image/jpeg, image/png, application/msword,
  application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`routes/printJob.ts:13-19`)
- Max 50 MB → multer rejects larger with an error; missing/unsupported → `400 { error }`.
- Stored as `uploads/<uuid>.<lowercased-ext>`, served ONLY via the token-gated
  `GET /api/files/:name` proxy (never statically — issue #10).
- Upload grants preview BEFORE dispatch: `fileToken` (15 min) as `?token=` or
  `x-file-token`. After dispatch, the job's `x-print-job-token` or the kiosk's
  `x-kiosk-id` + `x-kiosk-token` headers authorize. Anything else → 404.

```bash
curl -sS -X POST http://localhost:4000/api/upload -F 'file=@sample.pdf'
# 201 { "fileUrl": "http://localhost:4000/api/files/<uuid>.pdf", "fileToken": "<hex>", "fileName": "...", "mimeType": "...", "size": 12345 }
```

## Download a file (token-gated)

`GET /api/files/:name` — filename must match `uploads/<uuid>.<ext>` (else 404).
Needs one of: `?token=<fileToken>` / `x-file-token`, `x-print-job-token` of a
job referencing the file, or kiosk credentials (`x-kiosk-id` + `x-kiosk-token`)
for a kiosk with a job on the file. All failures → `404 { error }` (no oracle).

## List online kiosks (public)

`GET /api/kiosks` → `{ kiosks: [{ kioskId, displayName, online: true, connectedAt }] }`.
Offline kiosks are filtered out here (admin overview shows all — see below).

## Create a print job

`POST /api/print-job` — JSON, zod-validated:

```json
{ "kioskId": "kiosk-lab-1", "fileUrl": "https://example.com/sample.pdf",
  "copies": 1, "color": "bw", "duplex": false }
```

Constraints: `kioskId` non-empty; `fileUrl` valid URL; `copies` int 1–50; `color` `bw|color`; `duplex` bool.

Per-kiosk FIFO queue (issue #12): the first job for an idle kiosk dispatches
immediately (`SENT_TO_KIOSK, position 0`); further jobs hold as `QUEUED` with
`position` = jobs ahead (0 = with the kiosk). Terminal kiosk status hands the
next queued job over automatically. `JOB_STATUS` events carry `position`.

```bash
curl -sS -X POST http://localhost:4000/api/print-job -H 'Content-Type: application/json' \
  -d '{"kioskId":"kiosk-lab-1","fileUrl":"https://example.com/sample.pdf","copies":1,"color":"bw","duplex":false}'
# online:  201 { "printJobId": "<uuid>", "accessToken": "<48hex>", "status": "SENT_TO_KIOSK" }
# offline: 503 { "error": "Kiosk offline", "kioskId": "kiosk-lab-1" }
# invalid: 400 { "error": "Invalid print job payload", "details": { ...zod flatten... } }
```

## Cancel a queued print job

`DELETE /api/print-job/:printJobId` — header `x-print-job-token: <accessToken>`.
Only `QUEUED` (not yet sent) jobs cancel → `200 { printJobId, status: "CANCELLED" }`.
Anything else → `409 { error }`; wrong/missing token or unknown id → `404`.

## Payments (test provider, issue #17)

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/quote` | `{ copies 1–50, pages 1–1000?, color, duplex }` | `{ copies, pages, color, duplex, unit, total }` (server-priced) |
| POST | `/api/pay` | same as quote | `201 { paymentIntentId, total, status: "confirmed" }` (NOT a real charge) |
| GET | `/api/pay/:id` | — | `{ paymentIntentId, total, status, jobId }` |
| POST | `/api/pay/:id/void` | — | `{ paymentIntentId, status: "voided" }` (404 when unknown/already voided) |

`POST /api/print-job` accepts `paymentIntentId`; with `REQUIRE_PAYMENT=true`
dispatch without a confirmed intent → `402`. Failed prints auto-void the
linked intent (also fires on watchdog-stalled jobs).

## Read a print job (token-gated)

`GET /api/print-job/:printJobId` — header `x-print-job-token: <accessToken>`.
Wrong/missing token or unknown id → `404 { error: "Print job not found" }` (deliberately no 403 to avoid id oracle).
Success returns `{ printJobId, kioskId, copies, color, duplex, status, createdAt, updatedAt, history }`
(`fileUrl` and `accessToken` included in store but only non-secret fields are serialized here —
note `fileUrl` IS omitted from this response; use the upload response value).

## Admin

All require header `x-admin-token: <ADMIN_TOKEN>`, else `401 { error: "Admin authentication required" }`.

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/admin/kiosks/enroll` | `{ kioskId, displayName, enrollmentToken }` | `201 { kioskId, displayName, token }` (one-time kiosk token). `401` on bad enrollment token or Supabase unconfigured |
| GET | `/api/admin/overview` | — | `{ kiosks: [{ kioskId, displayName, online, connectedAt? }], jobs: [...last 100, no accessToken/fileUrl], summary: { kiosksOnline, jobsTotal, jobsActive } }` |
| PATCH | `/api/admin/kiosks/:kioskId` | `{ displayName: "1–80 chars" }` | `{ kioskId, displayName }`. `503` when Supabase unconfigured, `404` when kiosk unknown |

## Status + error-code reference

Statuses: `QUEUED, SENT_TO_KIOSK, DOWNLOAD_START, DOWNLOAD_COMPLETE, PRINTING_STARTED,
PRINT_SUCCESS, ERROR, PRINTER_ERROR, CANCELLED (reserved, no writer yet)`.
Error codes (server-derived from message): `PRINTER_NO_DEFAULT_DESTINATION,
DOCUMENT_DOWNLOAD_FAILED, DOCUMENT_CONVERSION_FAILED, OPERATION_TIMEOUT,
PRINTER_COMMAND_FAILED, KIOSK_JOB_ERROR`. History entries carry `{ status, message?, errorCode?, at }`.
