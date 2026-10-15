# Pilot checklist — 1 backend + 1 web + 2 kiosks, 2 weeks (issue #16)

## Deploy

1. **Backend** (always-on host, e.g. library server):
   `cd apps/backend && npm install && npm run build`
   Env: `PORT=4000`, `PUBLIC_URL=https://<reachable-by-kiosks>`,
   `CORS_ORIGIN=https://<web-url>`, `ADMIN_TOKEN=<strong>`,
   `KIOSK_ENROLLMENT_TOKEN=<strong>`, `AUTO_ENROLL_KIOSKS=false`,
   plus Supabase vars for job durability (issue #9).
   Run under systemd or `npm start`; confirm `GET /health`.
2. **Web**: `cd apps/web && npm install && npm run build && npm start -p 3000`
   with `NEXT_PUBLIC_BACKEND_URL=https://<backend>`. Serve behind the same
   reverse proxy if cross-origin websockets are an issue.
3. **2 kiosks** (Mini PCs): follow `docs/OPERATIONS.md` provisioning
   (provision script → identity → enroll via admin console → systemd unit).
   Verify each in `GET /api/kiosks` and with a test dispatch to `PRINT_SUCCESS`.

## Staff one-pager

| Symptom | Do this |
|---|---|
| User sees "No printers online" | `systemctl status kiosk-client` on each Mini PC; backend `GET /health` (`onlineKiosks`); re-enroll if token rotated |
| User sees "printer just went offline" at Send | Pick the other kiosk; resend (queue position shows in tracking) |
| "Printer disconnected" amber banner | Check the output tray first (pages may exist), then Send again |
| `PRINTER_NO_DEFAULT_DESTINATION` | On the Mini PC: `npm run health`, then `lpadmin -d <printer>` |
| Upload rejected | Confirm PDF/JPG/PNG/DOC/DOCX and ≤ 50 MB |

## Measure (go / no-go at week 2)

Daily: `BACKEND_URL=… ADMIN_TOKEN=… bash scripts/pilot-snapshot.sh`
(track `pilot-data/`; success = `PRINT_SUCCESS` / terminal jobs).

- [ ] 95% `PRINT_SUCCESS` over 2 weeks
- [ ] Median upload → collect < 2 min (measure at pickup during staffed hours)
- [ ] Blocking issues filed with `printJobId` + logs, or explicit go
