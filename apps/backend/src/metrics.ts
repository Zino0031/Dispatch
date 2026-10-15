import type { PrintJobRecord } from "./jobs/types.js";

const TERMINAL = new Set(["PRINT_SUCCESS", "ERROR", "PRINTER_ERROR", "CANCELLED"]);
const CODE_RE = /(PRINTER_[A-Z_]+|DOCUMENT_[A-Z_]+|OPERATION_TIMEOUT|KIOSK_JOB_ERROR)/;

export interface KioskMetric {
  kioskId: string;
  online: boolean;
  total: number;
  success: number;
  rate: number | null;
}

export interface FleetMetrics {
  windowDays: number | null;
  jobsTotal: number;
  jobsTerminal: number;
  successRate: number | null;
  errorBreakdown: Record<string, number>;
  medianUploadToSuccessMs: number | null;
  perKiosk: KioskMetric[];
}

/** Failure class from history messages (codes ride in messages, docs/API.md). */
export function failureClass(job: PrintJobRecord): string {
  for (const h of job.history) {
    const m = CODE_RE.exec(h.message ?? "");
    if (m) return m[1].startsWith("PRINTER_") ? `PRINTER (${m[1]})` : `DOCUMENT (${m[1]})`;
  }
  return job.status === "ERROR" ? "KIOSK_JOB_ERROR (unspecified)" : job.status;
}

export function computeMetrics(
  jobs: PrintJobRecord[],
  onlineIds: Set<string>,
  windowDays: number | null,
  now = Date.now(),
): FleetMetrics {
  const inWindow =
    windowDays === null
      ? jobs
      : jobs.filter((j) => now - Date.parse(j.createdAt) <= windowDays * 86_400_000);
  const terminal = inWindow.filter((j) => TERMINAL.has(j.status));
  const success = terminal.filter((j) => j.status === "PRINT_SUCCESS").length;
  const breakdown: Record<string, number> = {};
  for (const j of terminal) {
    if (j.status === "PRINT_SUCCESS" || j.status === "CANCELLED") continue;
    const cls = failureClass(j);
    breakdown[cls] = (breakdown[cls] ?? 0) + 1;
  }
  const durations: number[] = [];
  for (const j of inWindow) {
    if (j.status !== "PRINT_SUCCESS") continue;
    const done = j.history.find((h: { status: string }) => h.status === "PRINT_SUCCESS");
    if (done) durations.push(Date.parse(done.at) - Date.parse(j.createdAt));
  }
  durations.sort((a, b) => a - b);
  const median =
    durations.length === 0
      ? null
      : durations.length % 2 === 1
        ? durations[(durations.length - 1) / 2]
        : Math.round((durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2);

  const byKiosk = new Map<string, { total: number; success: number }>();
  for (const j of inWindow) {
    const e = byKiosk.get(j.kioskId) ?? { total: 0, success: 0 };
    e.total += 1;
    if (j.status === "PRINT_SUCCESS") e.success += 1;
    byKiosk.set(j.kioskId, e);
  }
  const perKiosk: KioskMetric[] = [...byKiosk.entries()].map(([kioskId, e]) => ({
    kioskId,
    online: onlineIds.has(kioskId),
    total: e.total,
    success: e.success,
    rate: e.total === 0 ? null : Math.round((e.success / e.total) * 1000) / 10,
  }));

  return {
    windowDays,
    jobsTotal: inWindow.length,
    jobsTerminal: terminal.length,
    successRate: terminal.length === 0 ? null : Math.round((success / terminal.length) * 1000) / 10,
    errorBreakdown: breakdown,
    medianUploadToSuccessMs: median,
    perKiosk,
  };
}
