export const KIOSK_STATUS_EVENTS = [
  "SENT_TO_KIOSK",
  "DOWNLOAD_START",
  "DOWNLOAD_COMPLETE",
  "PRINTING_STARTED",
  "PRINT_SUCCESS",
  "ERROR",
  "PRINTER_ERROR",
] as const;

export type KioskStatusEvent = (typeof KIOSK_STATUS_EVENTS)[number];

export type PrintJobStatus =
  | "QUEUED"
  | KioskStatusEvent
  | "CANCELLED";

export type PrintColor = "bw" | "color";

export interface NewPrintJobPayload {
  printJobId: string;
  kioskId: string;
  fileUrl: string;
  copies: number;
  color: PrintColor;
  duplex: boolean;
}

export interface KioskStatusPayload {
  printJobId: string;
  event: KioskStatusEvent;
  message?: string;
}

export interface PrintJobRecord {
  printJobId: string;
  kioskId: string;
  fileUrl: string;
  copies: number;
  color: PrintColor;
  duplex: boolean;
  status: PrintJobStatus;
  accessToken: string;
  createdAt: string;
  updatedAt: string;
  history: PrintJobStatusEntry[];
  lastError?: PrintJobError;
}

export interface PrintJobStatusEntry {
  status: PrintJobStatus;
  message?: string;
  errorCode?: string;
  at: string;
}

export interface PrintJobError {
  code: string;
  message: string;
  status: "ERROR" | "PRINTER_ERROR";
  at: string;
}

export interface RegisteredKiosk {
  kioskId: string;
  displayName: string;
  socketId: string;
  connectedAt: Date;
}

export interface KioskSettings {
  kioskId: string;
  displayName: string;
  authTokenHash: string;
  revokedAt?: string;
  lastSeenAt?: string;
}
