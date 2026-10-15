import { randomBytes, randomUUID } from "node:crypto";
import type {
  NewPrintJobPayload,
  PrintJobRecord,
  PrintJobStatus,
} from "../types.js";

function errorCode(status: PrintJobStatus, message?: string): string | undefined {
  if (status !== "ERROR" && status !== "PRINTER_ERROR") return undefined;
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("no default destination")) return "PRINTER_NO_DEFAULT_DESTINATION";
  if (normalized.includes("download") || normalized.includes("http")) return "DOCUMENT_DOWNLOAD_FAILED";
  if (normalized.includes("document_conversion_failed")) return "DOCUMENT_CONVERSION_FAILED";
  if (normalized.includes("timeout") || normalized.includes("timed out")) return "OPERATION_TIMEOUT";
  if (status === "PRINTER_ERROR") return "PRINTER_COMMAND_FAILED";
  return "KIOSK_JOB_ERROR";
}

export type CreatePrintJobInput = Omit<NewPrintJobPayload, "printJobId">;

export class JobStore {
  private readonly jobs = new Map<string, PrintJobRecord>();

  create(input: CreatePrintJobInput): PrintJobRecord {
    const now = new Date().toISOString();
    const record: PrintJobRecord = {
      ...input,
      printJobId: randomUUID(),
      status: "QUEUED",
      accessToken: randomBytes(24).toString("hex"),
      createdAt: now,
      updatedAt: now,
      history: [{ status: "QUEUED", at: now }],
    };
    this.jobs.set(record.printJobId, record);
    return record;
  }

  get(printJobId: string): PrintJobRecord | undefined {
    return this.jobs.get(printJobId);
  }

  list(): PrintJobRecord[] {
    return [...this.jobs.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  canAccess(printJobId: string, accessToken: string): boolean {
    return this.jobs.get(printJobId)?.accessToken === accessToken;
  }

  updateStatus(
    printJobId: string,
    status: PrintJobStatus,
    message?: string,
  ): PrintJobRecord | undefined {
    const job = this.jobs.get(printJobId);
    if (!job) {
      return undefined;
    }

    const at = new Date().toISOString();
    const code = errorCode(status, message);
    job.status = status;
    job.updatedAt = at;
    job.history.push({ status, message, errorCode: code, at });
    if (
      code &&
      message &&
      (status === "ERROR" || status === "PRINTER_ERROR")
    ) {
      job.lastError = { code, message, status, at };
    }
    return job;
  }
}

export const jobStore = new JobStore();