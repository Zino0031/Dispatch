# AGENTS.md — Print Kiosk Agent Rules

This file governs all AI agents and human contributors working in this repo.
It is the single source of truth for how to build, edit, and verify code here.

## 1. Repo map (read this first)

```
apps/backend/       Express 4 + Socket.io 4 API. Source of truth for jobs, kiosks.
  src/index.ts      App bootstrap (Express + HTTP + Socket.io)
  src/config.ts     Env parsing, CORS, room helpers (kioskRoom, jobRoom)
  src/socket.ts     Socket.io auth + NEW_PRINT_JOB / kiosk_status / JOB_STATUS
  src/kioskRegistry.ts  Online map + Supabase kiosk settings + enroll/auth
  src/kioskAuth.ts  scrypt token hash/verify
  src/jobs/jobStore.ts  In-memory JobStore (jobs do NOT survive restart)
  src/routes/printJob.ts  POST /api/upload, GET /api/kiosks, POST /api/print-job, GET /api/print-job/:id
  src/routes/admin.ts     POST /api/admin/kiosks/enroll, GET /api/admin/overview, PATCH /api/admin/kiosks/:kioskId
  src/supabase.ts   Optional Supabase admin client (graceful null when unconfigured)
apps/web/           Next.js 15 + React 19 user UI (6-step wizard: Mode→Document→Options→Review→Checkout→Send)
  app/page.tsx      Full wizard + scan editor + live JOB_STATUS tracking
  app/admin/        Operations console (uses x-admin-token)
  app/backend.ts    backendUrl() helper, app/scan.ts canvas warp utils
apps/kiosk-client/  Mini-PC print agent (Node + CUPS + LibreOffice)
  src/index.ts      Socket client, NEW_PRINT_JOB handler, single-job guard
  src/downloader.ts HTTP(S)-only fetch with size/timeout caps
  src/documentNormalizer.ts  DOC/DOCX → PDF via LibreOffice, passthrough otherwise
  src/printer.ts    CUPS `lp` + `lpstat` polling, 30s completion timeout
  src/identity.ts   MAC-address kiosk ID fallback, src/config.ts env + token file
```

Skill: `web-design-guidelines` (in `.opencode/skills/`) applies to **all work in `apps/web/`**.
Load it with the skill tool before touching web UI.

## 2. Hard rules

1. **Evidence before synthesis.** Read the files you touch before editing. Never claim behavior you did not read.
2. **Prefer edit over create.** Do not add new files unless the task requires it. Never create markdown unless asked.
3. **Small diffs.** Keep `oldString` boundaries minimal. One logical change per edit.
4. **No secret leaks.** Never print or commit `.env` values, `KIOSK_TOKEN`, `ADMIN_TOKEN`, Supabase service-role keys, or `.kiosk-token` contents. Use `.env.example` as the reference.
5. **No dependency upgrades** unless the user asks. Match existing majors (Express 4, Socket.io 4, Next 15, React 19).
6. **Rooms are the contract.** Backend rooms are `kiosk:{kioskId}` and `job:{printJobId}` (`apps/backend/src/config.ts:91-97`). Do not rename events (`NEW_PRINT_JOB`, `kiosk_status`, `JOB_STATUS`, `KIOSK_ENROLLED`) without updating all three apps.
7. **JobStore is ephemeral.** `apps/backend/src/jobs/jobStore.ts` is in-memory. Do not treat jobs as durable. If persistence is needed, say so explicitly instead of silently assuming it.
8. **Validate at the boundary.** Backend uses zod for `POST /api/print-job`; kiosk-client validates `NEW_PRINT_JOB` with `isPrintJobPayload`; web validates files client-side (`ALLOWED_EXTS`, 50 MB). Keep all three in sync when changing limits or types.
9. **CUPS assumptions stay explicit.** `printer.ts` requires a CUPS default destination and polls `lpstat` for 30 s. Never swallow CUPS errors — they map to `PRINTER_ERROR`.
10. **Verify by running.** After backend changes run `npm run build` (tsc) in `apps/backend`; after kiosk-client changes run `npm run build` in `apps/kiosk-client`; after web changes run `npm run build` or `npm run lint` in `apps/web`. Report the exact command and result.

## 3. Stack conventions

- **Language:** TypeScript strict everywhere. ESM (`"type": "module"`) in backend and kiosk-client; Next.js App Router in web.
- **Backend:** Express JSON limit `1mb`; multer 50 MB disk upload to `uploads/`; static serve on `/uploads`. CORS allowlist = `CORS_ORIGIN` + localhost + private IPv4 (`isAllowedCorsOrigin`).
- **Auth:**
  - Kiosk socket auth = `{ role: "kiosk", kioskId, token }`, scrypt-verified (`kioskAuth.ts`). Empty token only works when `AUTO_ENROLL_KIOSKS=true`, then server emits `KIOSK_ENROLLED` with a one-time token the client must persist with mode `0o600`.
  - User socket auth = `{ role: "user", printJobId }`, joins `job:{printJobId}` for `JOB_STATUS` only.
  - Admin REST = header `x-admin-token`. Job read = header `x-print-job-token`.
- **Status lifecycle (exact strings):** `QUEUED → SENT_TO_KIOSK → DOWNLOAD_START → DOWNLOAD_COMPLETE → PRINTING_STARTED → PRINT_SUCCESS`, failures `ERROR | PRINTER_ERROR`, plus `CANCELLED`. Defined in `apps/backend/src/types.ts:1-16`. Kiosk is the only writer of post-`SENT_TO_KIOSK` transitions (via `kiosk_status`).
- **Error codes (jobStore):** `PRINTER_NO_DEFAULT_DESTINATION`, `DOCUMENT_DOWNLOAD_FAILED`, `DOCUMENT_CONVERSION_FAILED`, `OPERATION_TIMEOUT`, `PRINTER_COMMAND_FAILED`, `KUSB_JOB_ERROR`-family fallback `KIOSK_JOB_ERROR`. Do not invent new codes without adding them to `errorCode()` and docs.
- **Web:** `"use client"` wizard in `app/page.tsx`. Pricing is a client constant (`UNIT_PRICE = { bw: 5, color: 20 }`, test `tapTest()` payment only — no real gateway). Preview: PDF via iframe object URL, DOCX via mammoth, images via canvas scan pipeline (`scan.ts`: `detectDocument`, `warpQuad`).

## 4. Workflow per app

### Backend (`apps/backend`)
```bash
cp .env.example .env   # then set ADMIN_TOKEN, KIOSK_ENROLLMENT_TOKEN, SUPABASE_* as needed
npm install
npm run dev            # tsx watch src/index.ts
npm run fake-kiosk     # scripts/fake-kiosk.ts — simulated kiosk for local dispatch
npm run build          # tsc, must pass before handing off
```
Key env: `PORT, PUBLIC_URL, CORS_ORIGIN, ADMIN_TOKEN, KIOSK_ENROLLMENT_TOKEN, AUTO_ENROLL_KIOSKS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (secret only, never sb_publishable_), SUPABASE_STORAGE_BUCKET, PRINT_DOCUMENT_RETENTION_HOURS`.

### Web (`apps/web`)
```bash
npm install
npm run dev    # next dev (default :3000, must be in backend CORS_ORIGIN)
npm run lint
npm run build
```
`backendUrl()` in `app/backend.ts` decides the API base. Kiosk list comes from `GET /api/kiosks` (online only). Job flow is upload → create job → open user socket → render `JOB_STATUS` map.

### Kiosk client (`apps/kiosk-client`)
```bash
cp .env.example .env   # SERVER_URL required; KIOSK_ID optional (MAC fallback)
npm install
npm run dev            # tsx watch src/index.ts
npm run build
npm run identity       # prints MAC-derived KIOSK_ID
```
Runtime deps on the Mini PC: CUPS (`lp`, `lpstat`, `cancel`) with a default destination; LibreOffice for DOC/DOCX. Single-job guard (`activeJob`): while busy, new jobs get `ERROR "Kiosk is already processing another job"`. Files are downloaded with `0o600`, then deleted in `finally` (both original and converted PDF).

## 5. Testing & verification matrix

| Change area | Minimum verification |
|---|---|
| Backend route/socket | `npm run build` + `curl GET /health` + dispatch via `npm run fake-kiosk` + `POST /api/print-job` (expect 201 online, 503 offline) |
| Kiosk client | `npm run build` + connect to dev backend, verify `DOWNLOAD_* → PRINTING_STARTED → PRINT_SUCCESS/ERROR` sequence in backend logs |
| Web wizard | `npm run lint` + `npm run build` + manual 6-step pass with no kiosk (expect graceful "offline") and with fake-kiosk (expect live timeline) |
| Auth change | Negative tests: wrong admin token → 401, wrong kiosk token → `connect_error Invalid kiosk credentials`, wrong job token → 404 |

## 6. What NOT to do

- Do not add a real payment gateway, DB persistence for jobs, or multi-job queueing without a plan — current design is test-payment, in-memory jobs, single active job per kiosk.
- Do not serve `uploads/` publicly in production without signed URLs / retention enforcement (`PRINT_DOCUMENT_RETENTION_HOURS` is currently config-only).
- Do not bypass `isPrintJobPayload` / zod schemas with `as any`.
- Do not store tokens in git, logs, or error messages.

## 7. Definition of done

- Builds pass for every touched app.
- No `.env` / token files created or modified in git status.
- Socket event names and status strings unchanged (or changed consistently across backend + kiosk-client + web + docs).
- PR summary lists: files changed, verification commands run with output, and any intentional behavior change.
