import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { config } from "./config.js";
import { freeBytes } from "./disk.js";
import { checkCups } from "./printer.js";

const execFileAsync = promisify(execFile);

export interface HealthReport {
  ok: boolean;
  cups: { reachable: boolean; defaultDestination: string | null; detail: string };
  libreoffice: { present: boolean; version: string | null };
  disk: { tempDir: string; writable: boolean; freeBytes: number };
}

export async function checkHealth(): Promise<HealthReport> {
  const cups = await checkCups();
  const libreoffice = await checkLibreOffice();
  const writable = checkWritable();
  const free = freeBytes(config.tempDir);
  const ok =
    cups.reachable &&
    cups.defaultDestination !== null &&
    libreoffice.present &&
    writable &&
    free >= config.maxDownloadBytes;
  return { ok, cups, libreoffice, disk: { tempDir: config.tempDir, writable, freeBytes: free } };
}

async function checkLibreOffice(): Promise<{ present: boolean; version: string | null }> {
  try {
    const { stdout } = await execFileAsync("soffice", ["--version"], { timeout: 30_000 });
    return { present: true, version: stdout.trim().split("\n")[0] ?? null };
  } catch {
    return { present: false, version: null };
  }
}

function checkWritable(): boolean {
  try {
    fs.mkdirSync(config.tempDir, { recursive: true });
    fs.accessSync(config.tempDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await checkHealth();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
