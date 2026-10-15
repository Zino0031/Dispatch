# Architecture

## 1. Topology

```
┌─────────────┐   HTTPS/REST + Socket.io   ┌──────────────┐   Socket.io (outbound only)   ┌───────────────┐
│  apps/web   │ ─────────────────────────▶ │ apps/backend │ ◀──────────────────────────── │ kiosk-client  │
│ Next.js 15  │  POST /api/upload          │ Express +    │  NEW_PRINT_JOB  ─────────────▶│ Mini PC daemon│
│ (phone UI)  │  POST /api/print-job       │ Socket.io 4  │  ◀──────────── kiosk_status    │ CUPS + LO     │
│             │  user socket (JOB_STATUS)  │ JobStore*    │                               │               │
└─────────────┘                            └──────┬───────┘                               └───────┬───────┘
                                                  │ Supabase (optional, kiosks table only)      │ USB
                                                  ▼                                             ▼
                                           ┌──────────────┐                              ┌─────────────┐
                                           │   Supabase   │                              │   Printer   │
                                           │ kiosks table │                              │ (CUPS dest) │
                                           └──────────────┘                              └─────────────┘
```

`*` `JobStore` is in-memory (`apps/backend/src/jobs/jobStore.ts`). Supabase stores **kiosk
credentials/settings only**, not jobs or files (files live on backend disk under `uploads/`).

## 2. Data flow (happy path)

1. Web `POST /api/upload` (multipart `file`) → backend writes `uploads/<uuid>.<ext>`, returns `fileUrl = PUBLIC_URL/uploads/<name>`.
2. Web `POST /api/print-job { kioskId, fileUrl, copies, color, duplex }` → backend validates (zod),
   checks `isKioskOnline(kioskId)`, creates `PrintJobRecord { printJobId, accessToken }`, emits
   `NEW_PRINT_JOB` to room `kiosk:{kioskId}`, flips status to `SENT_TO_KIOSK`, and fans out `JOB_STATUS`
   to room `job:{printJobId}`.
3. Kiosk-client (already joined `kiosk:{kioskId}`) validates payload, emits `DOWNLOAD_START`,
   fetches the file, emits `DOWNLOAD_COMPLETE`, normalizes DOC→PDF if needed, emits
   `PRINTING_STARTED`, runs CUPS, emits `PRINT_SUCCESS` (or `ERROR`/`PRINTER_ERROR`).
4. Backend `kiosk_status` handler (`socket.ts:73-96`) verifies the job belongs to the sending kiosk,
   appends history via `jobStore.updateStatus`, and re-broadcasts `JOB_STATUS` to `job:{printJobId}`.
5. Web's user socket (joined `job:{printJobId}` at connect) renders the timeline.

## 3. Socket design

Rooms (see `apps/backend/src/config.ts:91-97`):

| Room | Members | Purpose |
|---|---|---|
| `kiosk:{kioskId}` | one kiosk socket (latest wins; older socket force-disconnected in `registerKiosk`) | targeted `NEW_PRINT_JOB` delivery |
| `job:{printJobId}` | any number of user sockets | `JOB_STATUS` fan-out, isolated per job |

Middleware roles (`socket.ts:25-56`):

| `auth.role` | Required fields | Result |
|---|---|---|
| `kiosk` (default) | `kioskId` + `token` (or empty token iff `AUTO_ENROLL_KIOSKS=true`) | joins kiosk room; may receive `KIOSK_ENROLLED { kioskId, token }` once |
| `user` | `printJobId` | joins job room, receive-only |

Events (exact names — do not rename unilaterally):

| Event | Direction | Payload |
|---|---|---|
| `NEW_PRINT_JOB` | backend → kiosk | `{ printJobId, kioskId, fileUrl, copies, color, duplex }` |
| `kiosk_status` | kiosk → backend | `{ printJobId, event, message? }`, event ∈ `KIOSK_STATUS_EVENTS` |
| `JOB_STATUS` | backend → user(s) | `{ printJobId, kioskId, event, message?, at }` |
| `KIOSK_ENROLLED` | backend → kiosk (once) | `{ kioskId, token }` — client persists to `KIOSK_TOKEN_FILE` mode `0o600` |

## 4. State model

`PrintJobStatus = QUEUED | SENT_TO_KIOSK | DOWNLOAD_START | DOWNLOAD_COMPLETE | PRINTING_STARTED | PRINT_SUCCESS | ERROR | PRINTER_ERROR | CANCELLED`
(`CANCELLED` is typed but has **no writer yet** — reserved.)
Each transition appends `{ status, message?, errorCode?, at }` to `record.history` and updates
`lastError` on failures. Error codes derive from message substrings in `jobStore.errorCode()`.

## 5. Auth & trust boundaries

- **Kiosk identity:** scrypt hash (`salt:hash`, `kioskAuth.ts`) stored in Supabase `kiosks.auth_token_hash`.
  `verifyKioskToken` uses `timingSafeEqual`. Three issuance paths: admin enroll API, auto-enroll on
  first connect, manual token via env/`tokenFile`.
- **Admin:** single shared `ADMIN_TOKEN` header (`x-admin-token`). No RBAC in v1.
- **User/job:** unguessable `accessToken` required as `x-print-job-token` for `GET /print-job/:id`.
  The live `JOB_STATUS` channel requires only the `printJobId` (by design for a demo; tighten before production).
- **Uploads:** unauthenticated static serving. Known gap — see PRD §8.3.

## 6. Failure modes

| Failure | Behavior today |
|---|---|
| Kiosk offline at dispatch | `503 Kiosk offline`, no job created |
| Kiosk disconnects mid-job | No timeout/retry; web shows "Live connection lost" on socket drop; job stuck at last status |
| Busy kiosk gets 2nd job | Immediate `ERROR "Kiosk is already processing another job"` for the 2nd job |
| CUPS no default printer | `PRINTER_NO_DEFAULT_DESTINATION` → `PRINTER_ERROR` |
| Download too large / non-HTTP(S) / bad status | `DOCUMENT_DOWNLOAD_FAILED` → `ERROR` |
| LibreOffice missing (DOC/DOCX) | `DOCUMENT_CONVERSION_FAILED` → `ERROR` |
| CUPS job > 30 s | `cancel <requestId>` attempted, then `PRINTER_USB_TIMEOUT` → `PRINTER_ERROR` |
| Backend restart | All jobs + online map lost; kiosks reconnect via `reconnection: true` |

## 7. Scaling notes

Single Node process, no sticky-session concerns (one backend instance owns both REST and Socket.io).
To scale: externalize `JobStore` + kiosk presence to Redis/Postgres, put Socket.io behind the
Redis adapter, and move `uploads/` to Supabase Storage (bucket name already configurable).
