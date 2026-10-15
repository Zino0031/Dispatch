/**
 * Web mirror of backend contracts (follower — see apps/backend/src/contracts.ts).
 * Status strings, event names, room prefixes and the 50 MB limit must match
 * the backend exactly. Verified by scripts/check-contracts.sh.
 */

// Must match PRINT_JOB_STATUSES in apps/backend/src/contracts.ts.
export const STATUS_VALUES = [
  "QUEUED",
  "SENT_TO_KIOSK",
  "DOWNLOAD_START",
  "DOWNLOAD_COMPLETE",
  "PRINTING_STARTED",
  "PRINT_SUCCESS",
  "ERROR",
  "PRINTER_ERROR",
  "CANCELLED",
] as const;

// Must match SOCKET_EVENTS values in apps/backend/src/contracts.ts.
export const SOCKET_EVENTS = {
  NEW_PRINT_JOB: "NEW_PRINT_JOB",
  KIOSK_STATUS: "kiosk_status",
  JOB_STATUS: "JOB_STATUS",
  KIOSK_ENROLLED: "KIOSK_ENROLLED",
} as const;

// Room prefixes (kiosk:{id}, job:{id}) — must match backend helpers.
export const KIOSK_ROOM_PREFIX = "kiosk:";
export const JOB_ROOM_PREFIX = "job:";

// Must match MAX_FILE_BYTES in apps/backend/src/contracts.ts (50 MB).
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// Test pricing placeholder (docs/PRD.md §6) — label checkout "Test".
export const UNIT_PRICE = { bw: 5, color: 20 } as const;
