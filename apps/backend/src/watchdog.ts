import type { Server } from "socket.io";
import { SOCKET_EVENTS, jobRoom } from "./contracts.js";
import { getJobs } from "./jobs/jobStore.js";
import { completeActive } from "./jobs/queue.js";
import { log } from "./logger.js";

// Jobs making no progress past this long are declared stalled: they get a
// terminal ERROR (so the web never spins forever) and the kiosk queue
// advances. Uses updatedAt (last activity), not createdAt.
const IN_FLIGHT = new Set([
  "SENT_TO_KIOSK",
  "DOWNLOAD_START",
  "DOWNLOAD_COMPLETE",
  "PRINTING_STARTED",
]);

export function stuckTimeoutMs(): number {
  const v = Number(process.env.JOB_STUCK_TIMEOUT_MS ?? 600_000);
  return Number.isFinite(v) && v > 0 ? v : 600_000;
}

function intervalMs(): number {
  const v = Number(process.env.WATCHDOG_INTERVAL_MS ?? 60_000);
  return Number.isFinite(v) && v > 0 ? v : 60_000;
}

export async function checkStuckJobs(io: Server, now = Date.now()): Promise<string[]> {
  const fired: string[] = [];
  const store = getJobs();
  for (const job of await store.list()) {
    if (!IN_FLIGHT.has(job.status)) continue;
    if (now - Date.parse(job.updatedAt) < stuckTimeoutMs()) continue;
    const stalledInPrint = job.status === "PRINTING_STARTED";
    const message = stalledInPrint
      ? "Printer disconnected mid-print — check the output tray, then send again if pages are missing"
      : "Job stalled: kiosk stopped reporting — check the kiosk and resend";
    const prev = job.status;
    const updated = await store.updateStatus(job.printJobId, "ERROR", message);
    if (!updated) continue;
    fired.push(job.printJobId);
    log.warn("watchdog declared job stalled", {
      kioskId: job.kioskId,
      printJobId: job.printJobId,
      lastStatus: prev,
    });
    io.to(jobRoom(job.printJobId)).emit(SOCKET_EVENTS.JOB_STATUS, {
      printJobId: job.printJobId,
      kioskId: job.kioskId,
      event: "ERROR",
      message,
      position: 0,
      at: updated.updatedAt,
    });
    completeActive(job.kioskId, job.printJobId);
  }
  return fired;
}

/** Interval watchdog; disable with WATCHDOG=off. */
export function startWatchdog(io: Server): void {
  if (process.env.WATCHDOG === "off") return;
  const timer = setInterval(() => {
    void checkStuckJobs(io).catch((e) => {
      log.error("watchdog sweep failed", { error: e instanceof Error ? e.message : String(e) });
    });
  }, intervalMs());
  timer.unref?.();
}
