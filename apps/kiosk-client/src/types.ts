export type PrintColor = "bw" | "color";

export interface NewPrintJobPayload {
  printJobId: string;
  kioskId: string;
  fileUrl: string;
  copies: number;
  color: PrintColor;
  duplex: boolean;
  pages?: string;
}

export type KioskStatusEvent =
  | "DOWNLOAD_START"
  | "DOWNLOAD_COMPLETE"
  | "PRINTING_STARTED"
  | "PRINT_SUCCESS"
  | "ERROR"
  | "PRINTER_ERROR";

export const KIOSK_STATUS_EVENTS: KioskStatusEvent[] = [
  "DOWNLOAD_START",
  "DOWNLOAD_COMPLETE",
  "PRINTING_STARTED",
  "PRINT_SUCCESS",
  "ERROR",
  "PRINTER_ERROR",
];
