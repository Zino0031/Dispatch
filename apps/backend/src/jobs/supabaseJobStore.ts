import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrintJobStatus } from "../contracts.js";
import { newJob, type JobInput, type JobRepository, type PrintJobRecord } from "./types.js";

interface JobRow {
  print_job_id: string;
  access_token_sha256: string;
  kiosk_id: string;
  file_url: string;
  copies: number;
  color: "bw" | "color";
  duplex: boolean;
  payment_intent_id: string | null;
  user_id: string | null;
  pages_estimate: number | null;
  printer_name: string | null;
  status: PrintJobStatus;
  history: PrintJobRecord["history"];
  created_at: string;
  updated_at: string;
}

function sha256(s: string): Buffer {
  return createHash("sha256").update(s).digest();
}

function toRecord(row: JobRow): PrintJobRecord {
  return {
    printJobId: row.print_job_id,
    accessToken: "", // raw token never leaves the 201 response (stored hashed only).
    kioskId: row.kiosk_id,
    fileUrl: row.file_url,
    copies: row.copies,
    color: row.color,
    duplex: row.duplex,
    paymentIntentId: row.payment_intent_id ?? undefined,
    userId: row.user_id ?? undefined,
    pagesEstimate: row.pages_estimate ?? undefined,
    printer: row.printer_name ?? undefined,
    status: row.status,
    history: row.history,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Postgres-backed jobs (migration: supabase/migrations/20251015_jobs.sql). */
export class SupabaseJobs implements JobRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async create(input: JobInput): Promise<PrintJobRecord> {
    const record = newJob(input);
    const { error } = await this.sb.from("jobs").insert({
      print_job_id: record.printJobId,
      access_token_sha256: sha256(record.accessToken).toString("hex"),
      kiosk_id: record.kioskId,
      file_url: record.fileUrl,
      copies: record.copies,
      color: record.color,
      duplex: record.duplex,
      payment_intent_id: record.paymentIntentId ?? null,
      user_id: record.userId ?? null,
      pages_estimate: record.pagesEstimate ?? null,
      printer_name: record.printer ?? null,
      status: record.status,
      history: record.history,
    });
    if (error) throw new Error(`job persist failed: ${error.message}`);
    return record;
  }

  async get(printJobId: string): Promise<PrintJobRecord | undefined> {
    const { data, error } = await this.sb
      .from("jobs")
      .select("*")
      .eq("print_job_id", printJobId)
      .maybeSingle();
    if (error || !data) return undefined;
    return toRecord(data as JobRow);
  }

  async verifyAccess(printJobId: string, token: string): Promise<PrintJobRecord | undefined> {
    const { data, error } = await this.sb
      .from("jobs")
      .select("*")
      .eq("print_job_id", printJobId)
      .maybeSingle();
    if (error || !data) return undefined;
    const row = data as JobRow;
    const a = sha256(token);
    const b = Buffer.from(row.access_token_sha256, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
    return toRecord(row);
  }

  async updateStatus(
    printJobId: string,
    status: PrintJobStatus,
    message?: string,
  ): Promise<PrintJobRecord | undefined> {
    const current = await this.get(printJobId);
    if (!current) return undefined;
    const history = [...current.history, { status, message, at: new Date().toISOString() }];
    const { data, error } = await this.sb
      .from("jobs")
      .update({ status, history, updated_at: new Date().toISOString() })
      .eq("print_job_id", printJobId)
      .select("*")
      .maybeSingle();
    if (error || !data) return undefined;
    return toRecord(data as JobRow);
  }

  async list(): Promise<PrintJobRecord[]> {
    const { data, error } = await this.sb
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return [];
    return ((data ?? []) as JobRow[]).map(toRecord);
  }
}
