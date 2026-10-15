# Operations

## Backend env (`apps/backend/.env`)

| Var | Required | Notes |
|---|---|---|
| `PORT` | no (4000) | Listen port |
| `PUBLIC_URL` | no | Base used to build `fileUrl` for uploads — must be reachable by kiosks |
| `CORS_ORIGIN` | no (`http://localhost:3000`) | Comma-separated allowlist; localhost + private-LAN origins always allowed |
| `ADMIN_TOKEN` | yes (has dev fallback — change it) | Sent as `x-admin-token` |
| `KIOSK_ENROLLMENT_TOKEN` | yes (has dev fallback — change it) | One-time secret operators give to new kiosks |
| `AUTO_ENROLL_KIOSKS` | no (`false`) | `true` lets unknown kiosks self-enroll on first connect (pilot convenience; disable in production) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | for kiosk auth persistence | Secret key only — boot fails on `sb_publishable_` |
| `SUPABASE_STORAGE_BUCKET` | no (`print-documents`) | Reserved for future storage move; uploads are local disk today |
| `PRINT_DOCUMENT_RETENTION_HOURS` | no (24) | Config-only today — no sweeper enforces it yet |

## Web env
`backendUrl()` (`apps/web/app/backend.ts`) resolves the API base. Ensure the web origin is in
backend `CORS_ORIGIN` or on the same LAN, otherwise `/api/kiosks` fetch and user sockets fail.

## Kiosk env (`apps/kiosk-client/.env`)

| Var | Required | Notes |
|---|---|---|
| `SERVER_URL` | yes | e.g. `http://192.168.1.10:4000` (Mini PC → backend, outbound only) |
| `KIOSK_ID` | no | Defaults to MAC via `getHardwareId()`; override for testing |
| `KIOSK_TOKEN` | no | First boot may omit when `AUTO_ENROLL_KIOSKS=true`; then persisted to `KIOSK_TOKEN_FILE` |
| `KIOSK_TOKEN_FILE` | no (`.kiosk-token`) | Mode `0o600` credential file |
| `TEMP_DIR` / `MAX_DOWNLOAD_BYTES` / `DOWNLOAD_TIMEOUT_MS` | no | Defaults `./temp` / 50 MB / 60 s |

## Provisioning a Mini PC kiosk
1. Install Node 22+, CUPS (`lp, lpstat, cancel`), LibreOffice (for DOC/DOCX), set a CUPS default destination and print a test page.
2. `npm install && cp .env.example .env`, set `SERVER_URL`.
3. Get the ID: `npm run identity` (or let MAC fallback apply).
4. Enroll (pick one): (a) admin API `POST /api/admin/kiosks/enroll` → put `token` in `.env` as `KIOSK_TOKEN`;
   (b) set backend `AUTO_ENROLL_KIOSKS=true` for first boot, then disable it and keep the auto-saved `.kiosk-token`.
5. `npm run build && npm start` (use systemd with `Restart=always` in production).
6. Verify: backend log shows `Kiosk connected: <id>`; `GET /api/kiosks` lists it; dispatch a job and confirm `PRINT_SUCCESS`.

## Runbooks

**Kiosk offline (503 at dispatch):** check Mini PC power/network → `systemctl status kiosk-client` →
backend `GET /health` (`onlineKiosks`) → compare `KIOSK_ID` vs enrolled id → re-enroll if token rotated.

**`PRINTER_NO_DEFAULT_DESTINATION`:** `lpstat -d` on the Mini PC; set default with `lpadmin -d <printer>`; re-send job.

**Stuck `PRINTING_STARTED`:** check `lpstat -o`, CUPS `error_log`, USB cable; jobs auto-cancel after 30 s (`PRINTER_USB_TIMEOUT`).

**Bad upload (400):** confirm mimetype + ≤50 MB; `.doc` needs `application/msword`, `.docx` the OOXML type.

## Pre-pilot hardening TODO
systemd unit, CUPS/LibreOffice provision script, disk-space guard on `TEMP_DIR`/`uploads/`,
log rotation, and a retention sweeper for `uploads/` honoring `PRINT_DOCUMENT_RETENTION_HOURS`.
