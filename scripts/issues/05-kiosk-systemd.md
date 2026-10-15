## Context
Kiosk client runs `npm run build && npm start` today; production needs systemd with `Restart=always` (`docs/OPERATIONS.md`, `docs/PLAN.md` Phase 3 remaining).

## Scope
- [ ] Add `apps/kiosk-client/systemd/kiosk-client.service`: `Restart=always`, `RestartSec=5`, runs `npm start` (or `node dist/index.js`) with `WorkingDirectory` + `EnvironmentFile`.
- [ ] Document install: copy unit, `daemon-reload`, `enable --now`, `status` check (`docs/OPERATIONS.md` provisioning section).
- [ ] Verify reconnect: kiosk rejoins `kiosk:{kioskId}` on boot; backend log shows `Kiosk connected: <id>`; `GET /api/kiosks` lists it.
- [ ] Never commit `.env` / `.kiosk-token` (`docs/GUIDELINES.md`).

## Acceptance
- [ ] Fresh Mini PC prints PDF + JPG + DOCX end-to-end after following `docs/OPERATIONS.md` once (`docs/PLAN.md` Phase 3 exit).
- [ ] `kill -9` of node process → systemd restarts within ~5 s and kiosk reappears online.
