import { randomUUID } from "node:crypto";
import type { PrintJobStatus } from "../contracts.js";

export interface HistoryEntry {
  status: PrintJobStatus;
  message?: string;
  at: string;
}

export interface JobInput {
  kioskId: string;
  fileUrl: string;
  copies: number;
  color: "bw" | "color";
  duplex: boolean;
  paymentIntentId?: string;
  userId?: string;
  pagesEstimate?: number;
  printer?: string;
}

export interface PrintJobRecord extends JobInput {
  printJobId: string;
  /** Raw token only on creation (201 response). Stored as sha256 afterwards. */
  accessToken: string;
  status: PrintJobStatus;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface JobRepository {
  create(input: JobInput): Promise<PrintJobRecord>;
  get(printJobId: string): Promise<PrintJobRecord | undefined>;
  /** Undefined on mismatch — no id oracle (docs/API.md). */
  verifyAccess(printJobId: string, token: string): Promise<PrintJobRecord | undefined>;
  updateStatus(
    printJobId: string,
    status: PrintJobStatus,
    message?: string,
  ): Promise<PrintJobRecord | undefined>;
  list(): Promise<PrintJobRecord[]>;
}

export function newJob(input: JobInput): PrintJobRecord {
  const now = new Date().toISOString();
  return {
    ...input,
    printJobId: randomUUID(),
    // 24-byte hex access token (docs/PRD.md §5.3).
    accessToken: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 16),
    status: "QUEUED",
    history: [{ status: "QUEUED", at: now }],
    createdAt: now,
    updatedAt: now,
  };
}
