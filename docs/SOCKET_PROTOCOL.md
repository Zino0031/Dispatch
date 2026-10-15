# Socket Protocol

Transport: Socket.io 4, websocket preferred (`transports: ["websocket"]` on both clients).
CORS for sockets uses the same `isAllowedCorsOrigin` policy as REST.

## Connecting

### Kiosk
```ts
io(SERVER_URL, { auth: { role: "kiosk", kioskId, token }, transports: ["websocket"] })
```
- `kioskId` empty or token wrong → server middleware calls `next(new Error("Invalid kiosk credentials"))`,
  client sees `connect_error`.
- Empty `token` is accepted **only** when backend `AUTO_ENROLL_KIOSKS=true` and Supabase is configured:
  server creates a 32-byte `base64url` token, stores its scrypt hash, and emits `KIOSK_ENROLLED`.
- On success the socket joins room `kiosk:{kioskId}`. A second connect for the same `kioskId`
  force-disconnects the older socket (`registerKiosk`).

### User (live tracking)
```ts
io(BACKEND_URL, { auth: { role: "user", printJobId }, transports: ["websocket"] })
```
- Missing `printJobId` → `connect_error`. No token check in v1 (known gap, see ARCHITECTURE §5).
- Socket joins `job:{printJobId}` and receives only that job's `JOB_STATUS` events.

## Events

### `NEW_PRINT_JOB` (backend → kiosk room)
```json
{ "printJobId": "<uuid>", "kioskId": "kiosk-lab-1", "fileUrl": "http://.../uploads/x.pdf",
  "copies": 1, "color": "bw", "duplex": false }
```
Client guard (`isPrintJobPayload`): string ids/URL, integer copies, `color ∈ {bw,color}`,
boolean duplex, and `job.kioskId === config.kioskId`. Invalid → logged + ignored.
Busy (`activeJob === true`) → immediately emits `kiosk_status { event: "ERROR", message: "Kiosk is already processing another job" }`.

### `kiosk_status` (kiosk → backend)
```json
{ "printJobId": "<uuid>", "event": "DOWNLOAD_START | DOWNLOAD_COMPLETE | PRINTING_STARTED | PRINT_SUCCESS | ERROR | PRINTER_ERROR | SENT_TO_KIOSK", "message": "optional" }
```
Backend drops the message when: malformed, unknown event, unknown job, or job belongs to a
different kiosk. Otherwise appends history and re-broadcasts as `JOB_STATUS`.

Canonical kiosk sequence: `DOWNLOAD_START → DOWNLOAD_COMPLETE → PRINTING_STARTED → PRINT_SUCCESS`
(or `ERROR`/`PRINTER_ERROR` with a human message at the failure point).

### `JOB_STATUS` (backend → job room)
```json
{ "printJobId": "<uuid>", "kioskId": "kiosk-lab-1", "event": "PRINTING_STARTED",
  "message": "optional", "at": "2026-10-15T...Z" }
```
Web maps events to wizard step + label (`page.tsx:266-274`). Terminal events
(`PRINT_SUCCESS, ERROR, PRINTER_ERROR`) close the socket and re-enable Send.

### `KIOSK_ENROLLED` (backend → kiosk, at most once per auto-enroll)
```json
{ "kioskId": "kiosk-lab-1", "token": "<base64url>" }
```
Client writes it to `KIOSK_TOKEN_FILE` with mode `0o600`, updates `config.kioskToken` and
`socket.auth` in memory. The token is never logged.

## Local testing with fake-kiosk
```bash
cd apps/backend
npm run fake-kiosk   # connects as a test kiosk; honors KIOSK_ID/KIOSK_TOKEN env or defaults
```
Then `POST /api/print-job` and watch the server log + web timeline for the full event sequence.
