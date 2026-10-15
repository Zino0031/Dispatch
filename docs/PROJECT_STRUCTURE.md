# Project Structure

```
print-kiosk/
├── AGENTS.md                  Agent + contributor rules (read first)
├── README.md                  Quickstart (this file's companion)
├── package-lock.json          Workspace root (no workspaces configured yet)
├── .gitignore
├── docs/
│   ├── PRD.md                 Product requirements + acceptance criteria
│   ├── ARCHITECTURE.md        Topology, socket design, state, failures
│   ├── PROJECT_STRUCTURE.md   This file — where everything lives
│   ├── PLAN.md                Phased delivery plan + milestones
│   ├── API.md                 REST contract with examples
│   ├── SOCKET_PROTOCOL.md     Event/room/auth reference
│   ├── GUIDELINES.md          Code style + per-app conventions
│   └── OPERATIONS.md          Env, runbooks, provisioning a kiosk
├── .opencode/skills/
│   └── web-design-guidelines/ Mandatory skill for apps/web work
└── apps/
    ├── backend/               Phase 1 — Express + Socket.io API
    │   ├── src/
    │   │   ├── index.ts       Bootstrap: CORS, /health, routers, listen
    │   │   ├── config.ts      Env, CORS policy, kioskRoom()/jobRoom()
    │   │   ├── socket.ts      Auth middleware, event handlers, emitNewPrintJob
    │   │   ├── kioskRegistry.ts  Online map, Supabase hydrate/auth/enroll
    │   │   ├── kioskAuth.ts   scrypt hash/verify
    │   │   ├── supabase.ts    Optional admin client (null when unconfigured)
    │   │   ├── types.ts       Status unions, job/kiosk interfaces, event list
    │   │   ├── jobs/jobStore.ts  In-memory CRUD + history + error codes
    │   │   └── routes/
    │   │       ├── printJob.ts   Upload, kiosk list, create job, get job
    │   │       └── admin.ts      Enroll, overview, rename
    │   ├── scripts/fake-kiosk.ts  Simulated kiosk for local dev
    │   ├── supabase/migrations/   Kiosks table schema
    │   ├── uploads/           Local file store (gitignored content, served at /uploads)
    │   ├── .env / .env.example
    │   └── package.json       dev/build/start/fake-kiosk scripts
    ├── web/                   Phase 2 — Next.js user + admin UI
    │   ├── app/
    │   │   ├── page.tsx       6-step wizard + scan editor + live tracking (~1300 lines)
    │   │   ├── layout.tsx / globals.css
    │   │   ├── backend.ts     backendUrl() helper
    │   │   ├── scan.ts        detectDocument(), warpQuad(), DocPoint
    │   │   └── admin/         Operations console
    │   ├── next.config.ts / tsconfig.json
    │   └── package.json       dev/build/start/lint
    └── kiosk-client/          Phase 3–4 — Mini PC print agent
        ├── src/
        │   ├── index.ts       Socket lifecycle, single-job guard, processJob()
        │   ├── config.ts      SERVER_URL, KIOSK_ID (MAC fallback), token file
        │   ├── identity.ts    getHardwareId() from MAC
        │   ├── downloader.ts  Capped HTTP(S) fetch → temp file 0o600
        │   ├── documentNormalizer.ts  LibreOffice DOC→PDF, passthrough else
        │   ├── printer.ts     CUPS lp/lpstat/cancel wrapper
        │   └── types.ts       Client-side job/event types
        ├── temp/              Download workspace (cleaned per job)
        ├── .env / .env.example / .kiosk-token
        └── package.json       dev/build/start/identity
```

## Conventions

- One deployable per `apps/*`, each with its own `package.json`, `.env.example`, and `README` where non-trivial.
- Shared contracts are **duplicated, not imported**: `KIOSK_STATUS_EVENTS`, job payloads, and the 50 MB
  limit exist in all three apps. Changing one requires changing all three + `docs/API.md` + `docs/SOCKET_PROTOCOL.md`.
- Backend is the authority on status strings and room names; web and kiosk-client are followers.
- `uploads/` and `temp/` are runtime data, never committed. `.kiosk-token` is a credential, never committed.
