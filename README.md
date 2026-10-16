# Automated Self-Service Printing Kiosk

University print kiosk: users upload PDFs in the cloud; a thin-client Mini PC receives jobs over WebSocket and prints them locally.

## Layout

| Path | Phase | Status |
|---|---|---|
| `apps/backend` | 1 | Express + Socket.io API |
| `apps/web` | 2 | Next.js user UI (not started) |
| `apps/kiosk-client` | 3–4 | Mini PC print agent (not started) |

## Phase 1 — backend

```bash
cd apps/backend
cp .env.example .env
npm install
npm run dev
```

In another terminal, simulate a kiosk:

```bash
cd apps/backend
npm run fake-kiosk
```

Dispatch a job:

```bash
curl -sS -X POST http://localhost:4000/api/print-job \
  -H 'Content-Type: application/json' \
  -d '{"kioskId":"kiosk-lab-1","fileUrl":"https://example.com/sample.pdf","copies":1,"color":"bw","duplex":false}'
```

With no kiosk connected, the same request returns **503**.

## Docs

| Doc | Contents |
|---|---|
| `AGENTS.md` | Agent + contributor rules (read first) |
| `docs/PRD.md` | Requirements, scope, acceptance criteria |
| `docs/ARCHITECTURE.md` | Topology, socket design, state, failures |
| `docs/PROJECT_STRUCTURE.md` | Repo map |
| `docs/PLAN.md` | Phased delivery plan + milestones |
| `docs/API.md` | REST contract with examples |
| `docs/SOCKET_PROTOCOL.md` | Events, rooms, auth |
| `docs/GUIDELINES.md` | Code style + per-app conventions |
| `docs/OPERATIONS.md` | Env vars, provisioning, runbooks |
