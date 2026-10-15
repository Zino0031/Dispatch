import { timingSafeEqual } from "node:crypto";
import type { PrintJobStatus } from "../contracts.js";
import { newJob, type JobInput, type JobRepository, type PrintJobRecord } from "./types.js";

// Ephemeral default — jobs vanish on restart (docs/PRD.md §3).
// Supabase/Postgres backing engages when configured (issue #9).
const jobs = new Map<string, PrintJobRecord>();

function same(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

class MemoryJobs implements JobRepository {
  async create(input: JobInput): Promise<PrintJobRecord> {
    const record = newJob(input);
    jobs.set(record.printJobId, record);
    return record;
  }
  async get(printJobId: string): Promise<PrintJobRecord | undefined> {
    return jobs.get(printJobId);
  }
  async verifyAccess(printJobId: string, token: string): Promise<PrintJobRecord | undefined> {
    const job = jobs.get(printJobId);
    if (!job || !token || !same(token, job.accessToken)) return undefined;
    return job;
  }
  async updateStatus(
    printJobId: string,
    status: PrintJobStatus,
    message?: string,
  ): Promise<PrintJobRecord | undefined> {
    const job = jobs.get(printJobId);
    if (!job) return undefined;
    job.status = status;
    job.history.push({ status, message, at: new Date().toISOString() });
    job.updatedAt = new Date().toISOString();
    return job;
  }
  async list(): Promise<PrintJobRecord[]> {
    return [...jobs.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 100);
  }
}

export const memoryJobs = new MemoryJobs();
