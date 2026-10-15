/**
 * Authoritative shared contracts.
 * Backend is the authority on status strings, event names and room names;
 * apps/web and apps/kiosk-client mirror these values (see docs/PROJECT_STRUCTURE.md).
 * Changing anything here requires changing all three apps + docs/API.md +
 * docs/SOCKET_PROTOCOL.md, verified by scripts/check-contracts.sh.
 */

// Job lifecycle statuses (docs/ARCHITECTURE.md §4).
// CANCELLED is typed but has no writer yet — reserved.
export const PRINT_JOB_STATUSES = [
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
export type PrintJobStatus = (typeof PRINT_JOB_STATUSES)[number];

// Socket event names — exact names, do not rename unilaterally
// (docs/ARCHITECTURE.md §3, docs/SOCKET_PROTOCOL.md).
export const SOCKET_EVENTS = {
  NEW_PRINT_JOB: "NEW_PRINT_JOB",
  KIOSK_STATUS: "kiosk_status",
  JOB_STATUS: "JOB_STATUS",
  KIOSK_ENROLLED: "KIOSK_ENROLLED",
} as const;

// Events a kiosk may send via `kiosk_status` (docs/SOCKET_PROTOCOL.md).
export const KIOSK_STATUS_EVENTS = [
  "DOWNLOAD_START",
  "DOWNLOAD_COMPLETE",
  "PRINTING_STARTED",
  "PRINT_SUCCESS",
  "ERROR",
  "PRINTER_ERROR",
  "SENT_TO_KIOSK",
] as const;

// Socket roles (docs/ARCHITECTURE.md §3).
export const SOCKET_ROLES = ["kiosk", "user"] as const;

// Room name helpers (docs/ARCHITECTURE.md §3, backend/src/config.ts).
export const kioskRoom = (kioskId: string): string => `kiosk:${kioskId}`;
export const jobRoom = (printJobId: string): string => `job:${printJobId}`;

// Server-derived error codes (docs/API.md).
export const ERROR_CODES = [
  "PRINTER_NO_DEFAULT_DESTINATION",
  "DOCUMENT_DOWNLOAD_FAILED",
  "DOCUMENT_CONVERSION_FAILED",
  "OPERATION_TIMEOUT",
  "PRINTER_COMMAND_FAILED",
  "KIOSK_JOB_ERROR",
] as const;

// File limits — must stay in sync across multer, web validateFile and
// kiosk downloader caps (docs/PRD.md §5.1, docs/GUIDELINES.md).
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
export const DOWNLOAD_TIMEOUT_MS = 60_000;
export const COPIES_MIN = 1;
export const COPIES_MAX = 50;
