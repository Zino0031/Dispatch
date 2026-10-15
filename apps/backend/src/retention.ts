import fs from "node:fs";
import path from "node:path";
import { getJobs } from "./jobs/jobStore.js";
import { log } from "./logger.js";
import { fileNameFromUrl } from "./routes/files.js";

const UPLOAD_DIR = "uploads";
// Active jobs keep their files: QUEUED through PRINTING_STARTED.
const ACTIVE = new Set(["QUEUED", "SENT_TO_KIOSK", "DOWNLOAD_START", "DOWNLOAD_COMPLETE", "PRINTING_STARTED"]);

export function retentionHours(): number {
  const v = Number(process.env.PRINT_DOCUMENT_RETENTION_HOURS ?? 24);
  return Number.isFinite(v) && v > 0 ? v : 24;
}

export interface SweepResult {
  deleted: string[];
  skippedActive: string[];
  kept: string[];
}

/** Delete uploads older than PRINT_DOCUMENT_RETENTION_HOURS, never touching
 * files backing active jobs. Structured log per deletion comes from the caller. */
export async function sweepUploads(dryRun: boolean): Promise<SweepResult> {
  const result: SweepResult = { deleted: [], skippedActive: [], kept: [] };
  const cutoff = Date.now() - retentionHours() * 3_600_000;
  const jobs = await getJobs().list();
  const protectedNames = new Set(
    jobs
      .filter((j) => ACTIVE.has(j.status))
      .map((j) => fileNameFromUrl(j.fileUrl))
      .filter((n): n is string => n !== null),
  );
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const e of entries) {
    if (!e.isFile()) continue;
    const full = path.join(UPLOAD_DIR, e.name);
    if (protectedNames.has(e.name.toLowerCase())) {
      result.skippedActive.push(e.name);
      continue;
    }
    let mtime: number;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {
      continue;
    }
    if (mtime > cutoff) {
      result.kept.push(e.name);
      continue;
    }
    if (dryRun) {
      result.deleted.push(e.name);
      continue;
    }
    try {
      fs.rmSync(full);
      result.deleted.push(e.name);
      log.info("retention sweep deleted file", { op: "retention-sweep", file: e.name });
    } catch {
      // Best effort per file — next sweep retries.
    }
  }
  return result;
}

/** Hourly sweeper; disable with RETENTION_SWEEPER=off. */
export function startRetentionSweeper(): void {
  if (process.env.RETENTION_SWEEPER === "off") return;
  const run = (): void => {
    void sweepUploads(false).catch(() => {});
  };
  const timer = setInterval(run, 3_600_000);
  timer.unref?.();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  const result = await sweepUploads(dryRun);
  log.info("retention sweep finished", { dryRun, ...result });
}
