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
1. Provision the OS: `sudo bash apps/kiosk-client/scripts/provision.sh [default-printer]`
   (Node 22+, CUPS + LibreOffice Writer, `lpadmin -d <printer>` default; fails loudly
   with no default destination). Then set a CUPS default if skipped and print a test page.
2. `npm install && cp .env.example .env`, set `SERVER_URL`.
3. Get the ID: `npm run identity` (or let MAC fallback apply).
4. Enroll (pick one): (a) admin API `POST /api/admin/kiosks/enroll` → put `token` in `.env` as `KIOSK_TOKEN`;
   (b) set backend `AUTO_ENROLL_KIOSKS=true` for first boot, then disable it and keep the auto-saved `.kiosk-token`.
5. `npm run build && npm start` for a smoke test. For production install the unit:
   `sudo cp systemd/kiosk-client.service /etc/systemd/system/`, edit `WorkingDirectory`,
   `EnvironmentFile` and `ExecStart` for the Mini PC paths, then
   `sudo systemctl daemon-reload && sudo systemctl enable --now kiosk-client`.
   Check `systemctl status kiosk-client` (Restart=always, RestartSec=5).
6. Verify: backend log shows `Kiosk connected: <id>`; `GET /api/kiosks` lists it; dispatch a job and confirm `PRINT_SUCCESS`.

## Runbooks

**Kiosk offline (503 at dispatch):** check Mini PC power/network → `systemctl status kiosk-client` →
backend `GET /health` (`onlineKiosks`) → compare `KIOSK_ID` vs enrolled id → re-enroll if token rotated.

**`PRINTER_NO_DEFAULT_DESTINATION`:** on the Mini PC run `npm run health` (names CUPS,
LibreOffice and disk problems in one command); `lpstat -d`; set default with `lpadmin -d <printer>`; re-send job.

**Stuck `PRINTING_STARTED`:** check `lpstat -o`, CUPS `error_log`, USB cable; jobs auto-cancel after 30 s (`PRINTER_USB_TIMEOUT`).

**Bad upload (400):** confirm mimetype + ≤50 MB; `.doc` needs `application/msword`, `.docx` the OOXML type.

## Logging

Kiosk logs go to the journal via the systemd unit (`StandardOutput/StandardError=journal`):
`journalctl -u kiosk-client -f`, persisted with `Storage=persistent` in journald.
Backend file-logging deployments: rotate with logrotate, e.g.
`/var/log/print-kiosk/*.log { daily rotate 14 compress missingok }`.
Every line is JSON with `kioskId`/`printJobId`/`event` where available — grep one
`printJobId` across backend + kiosk logs for the full trace. Tokens are
redacted (`[REDACTED]`) and must never appear (`docs/GUIDELINES.md`).

## Upload retention

`PRINT_DOCUMENT_RETENTION_HOURS` (default 24) is enforced by an hourly in-process
sweeper (`apps/backend/src/retention.ts`, disable with `RETENTION_SWEEPER=off`).
It deletes `uploads/*` older than the window, never touching files backing active
jobs (`QUEUED…PRINTING_STARTED`). Dry-run: `npm run sweep -- --dry-run` in
`apps/backend` (lists without deleting); each real deletion is JSON-logged.

## Pre-pilot hardening TODO
Done via issues #5–#11 (systemd unit, provision script, disk guards, log
rotation docs, retention sweeper). Remaining pilot work: issues #12–#16.
