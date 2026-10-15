import { randomUUID } from "node:crypto";
import type { PrintJobStatus } from "../contracts.js";

export interface HistoryEntry {
  status: PrintJobStatus;
  message?: string;
  at: string;
}

export interface PrintJobRecord {
  printJobId: string;
  accessToken: string;
  kioskId: string;
  fileUrl: string;
  copies: number;
  color: "bw" | "color";
  duplex: boolean;
  status: PrintJobStatus;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// In-memory only — jobs vanish on restart (docs/PRD.md §3).
// Persistence moves to Supabase/Postgres in issue #9.
const jobs = new Map<string, PrintJobRecord>();

function entry(status: PrintJobStatus, message?: string): HistoryEntry {
  return { status, message, at: new Date().toISOString() };
}

export function createJob(input: {
  kioskId: string;
  fileUrl: string;
  copies: number;
  color: "bw" | "color";
  duplex: boolean;
}): PrintJobRecord {
  const now = new Date().toISOString();
  const record: PrintJobRecord = {
    printJobId: randomUUID(),
    // 24-byte hex access token (docs/PRD.md §5.3).
    accessToken: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 16),
    ...input,
    status: "QUEUED",
    history: [entry("QUEUED")],
    createdAt: now,
    updatedAt: now,
  };
  // Realtime NEW_PRINT_JOB emit lands in issue #4; record SENT_TO_KIOSK now.
  record.status = "SENT_TO_KIOSK";
  record.history.push(entry("SENT_TO_KIOSK"));
  record.updatedAt = new Date().toISOString();
  jobs.set(record.printJobId, record);
  return record;
}

export function getJob(printJobId: string): PrintJobRecord | undefined {
  return jobs.get(printJobId);
}

/** Last 100 jobs, newest first (admin overview shape; tokens/fileUrls stripped by caller). */
export function listJobs(): PrintJobRecord[] {
  return [...jobs.values()]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 100);
}
