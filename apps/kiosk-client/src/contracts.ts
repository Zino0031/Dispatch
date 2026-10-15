/**
 * Kiosk-client mirror of backend contracts (follower).
 * Must match apps/backend/src/contracts.ts exactly.
 * Verified by scripts/check-contracts.sh.
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

// Must match KIOSK_STATUS_EVENTS in apps/backend/src/contracts.ts.
export const KIOSK_STATUS_EVENTS = [
  "DOWNLOAD_START",
  "DOWNLOAD_COMPLETE",
  "PRINTING_STARTED",
  "PRINT_SUCCESS",
  "ERROR",
  "PRINTER_ERROR",
  "SENT_TO_KIOSK",
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

// Must match downloader caps in apps/backend/src/contracts.ts.
export const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
export const DOWNLOAD_TIMEOUT_MS = 60_000;
