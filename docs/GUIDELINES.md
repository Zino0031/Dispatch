# Development Guidelines

## General
- TypeScript strict, no `any` at module boundaries. Validate external input (zod on backend,
  `isPrintJobPayload` on kiosk-client, `validateFile` on web) — never trust the wire.
- Keep the triple contract in sync: status strings (`types.ts` ↔ kiosk `types.ts` ↔ web `statusMap`),
  file limits (50 MB in multer ↔ `MAX_FILE_BYTES` ↔ downloader caps), event names (all three apps).
- Small, reversible commits per app. Never mix a backend contract change with a web restyle in one commit.

## Backend (`apps/backend`)
- Routes are factory functions taking `io` (`createPrintJobRouter(io)`) — keep it that way so
  `emitNewPrintJob` stays injectable/testable.
- New endpoints: add zod schema → explicit status codes (400 validation / 503 unavailable / 401 auth / 404 hidden) → update `docs/API.md` in the same change.
- Kiosk state lives in two maps: `kiosks` (ephemeral online) and `kioskSettings` (hydrated from Supabase).
  `kioskStatuses()` joins them — admin overview depends on this shape.
- Log with context: always include `kioskId` and `printJobId` where available. Never log tokens.
- `express.json({ limit: "1mb" })` stays; file bodies go through multer only.

## Kiosk client (`apps/kiosk-client`)
- One job at a time (`activeJob` flag). Any queueing change must also change the busy-`ERROR` contract + web messaging.
- `processJob` phases must each emit their status **before** the work, so a crash leaves an accurate last-status.
- Downloads: HTTP/S only, `redirect: "error"`, honor `MAX_DOWNLOAD_BYTES` + `DOWNLOAD_TIMEOUT_MS`,
  write `0o600`, delete in `finally` (both raw and converted paths).
- Printing: `requireDefaultPrinter()` first (clear `PRINTER_NO_DEFAULT_DESTINATION` message),
  then `lp` with `-t`, `-n`, optional duplex flag only — no driver-specific color flags.
  `waitForCompletion` polls `lpstat` 2 s interval / 30 s deadline, attempts `cancel` on timeout.
- Shell-outs use `execFile` (argv, no shell) with explicit timeouts. Include `jobId` in the CUPS title.

## Web (`apps/web`)
- **Before any UI work, load the `web-design-guidelines` skill.** Campus-print visual system + App Router patterns in that skill override generic Next.js habits.
- `app/page.tsx` is a single-client-component wizard (~1300 lines). Extract only with care:
  keep step state machine (`stage`, `maxReached`, `canLeave`, `goTo`) intact; test the full 6-step pass after refactor.
- Pricing (`UNIT_PRICE`) and fake payment (`tapTest`) are placeholders — label any checkout UI "Test" until a real gateway lands.
- Object URLs (`URL.createObjectURL`) must be revoked on replace/unmount (file preview + capture flow already do this — follow the pattern).
- Canvas scan pipeline order is fixed: rotate → detect/warp → filter → A4 layout → blob.
  `drawComposed` (print view) and `drawAdjust` (corner editor) share `rotatedRef`/`quad` state — don't split them across components without lifting refs.
- Admin console uses `x-admin-token` from user input (never hardcode); show 401 as "check admin token", not a stack trace.

## Env & secrets
- Reference `.env.example` files; real `.env` / `.kiosk-token` are gitignored and must never appear in diffs, logs, or docs.
- Supabase service-role key: server-only. Reject `sb_publishable_` values (backend already throws on boot — keep that guard).

## Verification (mandatory)
- Backend: `npm run build` (tsc). Kiosk-client: `npm run build`. Web: `npm run lint` + `npm run build`.
- Behavior: `GET /health`, fake-kiosk dispatch (201 online / 503 offline), wrong-token negatives (401/404/connect_error).
