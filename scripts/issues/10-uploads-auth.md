## Context — SECURITY
`uploads/` is statically served with no auth — needs signed URLs or same-origin proxy + retention sweeper (`docs/PRD.md §8.3`, `docs/ARCHITECTURE.md §5`, `§7`). `fileUrl = PUBLIC_URL/uploads/<name>` is returned on upload (`docs/ARCHITECTURE.md §2`).

## Scope
- [ ] Pick one: Supabase Storage signed URLs (bucket already configurable via `SUPABASE_STORAGE_BUCKET`) OR backend token-gated proxy (`GET /files/:id` requiring `x-print-job-token` or kiosk auth).
- [ ] Kiosk `downloader.ts` must keep: HTTP/S only, `redirect: "error"`, size + timeout caps.
- [ ] No anonymous directory listing; unguessable UUIDs alone are not access control — document threat model.
- [ ] Update `docs/API.md` + `docs/OPERATIONS.md` (`SUPABASE_STORAGE_BUCKET` is reserved for this move today).

## Acceptance
- [ ] `curl /uploads/<uuid>.pdf` without credentials → 401/404 (not the file) after the change.
- [ ] Kiosk can still download + print end-to-end (PDF + JPG + DOCX).
