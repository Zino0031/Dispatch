## Context
Config `PRINT_DOCUMENT_RETENTION_HOURS` exists (default 24 h) but no sweeper ships yet (`docs/PRD.md §3`, `docs/OPERATIONS.md`). Part of `docs/PLAN.md` Phase 4.2.

## Scope
- [ ] Backend cron/sweeper deleting `uploads/*` older than `PRINT_DOCUMENT_RETENTION_HOURS`; dry-run flag + structured log per deletion.
- [ ] systemd timer or `node-cron` — document choice in `docs/OPERATIONS.md`.
- [ ] If moving to Supabase Storage, sweep the bucket instead/in addition.
- [ ] Never delete a file backing an active (`QUEUED…PRINTING_STARTED`) job.

## Acceptance
- [ ] Expired file removed within 1 h of deadline; active-job file untouched; operator can dry-run.
