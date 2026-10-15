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
  let libreoffice = { present: false, version: null as string | null };
  try {
    const { stdout } = await execFileAsync("soffice", ["--version"], { timeout: 30_000 });
    libreoffice = { present: true, version: stdout.trim().split("\n")[0] };
  } catch {
    libreoffice = { present: false, version: null };
  }
  let writable = false;
  try {
    fs.mkdirSync(config.tempDir, { recursive: true });
    fs.accessSync(config.tempDir, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  const free = freeBytes(config.tempDir);
  const ok =
    cups.reachable &&
    cups.defaultDestination !== null &&
    libreoffice.present &&
    writable &&
    free >= config.maxDownloadBytes;
  return { ok, cups, libreoffice, disk: { tempDir: config.tempDir, writable, freeBytes: free } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await checkHealth();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
