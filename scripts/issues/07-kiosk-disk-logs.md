## Context
`docs/OPERATIONS.md` pre-pilot TODO: disk-space guard on `TEMP_DIR`/`uploads/`, log rotation, retention sweeper. Kiosk downloads honor `MAX_DOWNLOAD_BYTES`/`DOWNLOAD_TIMEOUT_MS`, write `0o600`, delete in `finally` (`docs/GUIDELINES.md`, `docs/PRD.md §5.5`).

## Scope
- [ ] Kiosk: pre-download disk check (`TEMP_DIR` free space > `MAX_DOWNLOAD_BYTES` + margin) else emit `ERROR` with clear message before `DOWNLOAD_START`.
- [ ] Backend: pre-upload disk check on `uploads/` else `507`/`503` with actionable message.
- [ ] logrotate config or pino/systemd-journal guidance for both backend and kiosk-client.
- [ ] Verify temp dir empty after success AND failure (`docs/PRD.md §7`).

## Acceptance
- [ ] Temp dir empty after success and after failure (manual + automated check).
- [ ] Full disk → job fails fast with human message, no partial files left behind.
