import { io, type Socket } from "socket.io-client";
import { config, saveToken } from "./config.js";
import { KIOSK_STATUS_EVENTS, SOCKET_EVENTS } from "./contracts.js";
import { normalizeDocument } from "./documentNormalizer.js";
import { downloadFile, removeTempFile } from "./downloader.js";
import { log } from "./logger.js";
import { checkCups, printFile, waitForCompletion } from "./printer.js";

interface PrintJobPayload {
  printJobId: string;
  kioskId: string;
  fileUrl: string;
  copies: number;
  color: string;
  duplex: boolean;
}

/** Client guard mirror of the backend contract (docs/SOCKET_PROTOCOL.md). */
function isPrintJobPayload(msg: unknown, kioskId: string): msg is PrintJobPayload {
  const j = msg as Record<string, unknown>;
  return (
    typeof j?.printJobId === "string" &&
    j.kioskId === kioskId &&
    typeof j.fileUrl === "string" &&
    Number.isInteger(j.copies) &&
    (j.color === "bw" || j.color === "color") &&
    typeof j.duplex === "boolean"
  );
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// One job at a time (docs/GUIDELINES.md). Any queueing change must also change
// the busy-ERROR contract + web messaging (issue #12).
let activeJob: string | null = null;
let lastPhase: (typeof KIOSK_STATUS_EVENTS)[number] | null = null;
let socket: Socket | null = null;
let everConnected = false;

function status(printJobId: string, event: (typeof KIOSK_STATUS_EVENTS)[number], message?: string): void {
  lastPhase = event;
  socket?.emit(SOCKET_EVENTS.KIOSK_STATUS, { printJobId, event, message });
}

/** Print pipeline. Each phase emits its status BEFORE the work so a crash
 * leaves an accurate last-status (docs/GUIDELINES.md). Real path runs when
 * DRY_RUN=false (provisioned Mini PC, issue #6); DRY_RUN simulates timings. */
async function processJob(job: PrintJobPayload): Promise<void> {
  activeJob = job.printJobId;
  const temps: string[] = [];
  try {
    status(job.printJobId, "DOWNLOAD_START");
    log.info("job download started", { kioskId: config.kioskId, printJobId: job.printJobId });
    let file: string | null = null;
    if (config.dryRun) {
      await wait(300);
    } else {
      file = await downloadFile(job.fileUrl);
      temps.push(file);
    }
    status(job.printJobId, "DOWNLOAD_COMPLETE");
    log.info("job download complete", { kioskId: config.kioskId, printJobId: job.printJobId });
    if (!config.dryRun && file) {
      const normalized = await normalizeDocument(file, "");
      if (normalized !== file) {
        temps.push(normalized);
        file = normalized;
      }
    } else {
      await wait(200);
    }
    status(job.printJobId, "PRINTING_STARTED");
    if (config.dryRun) {
      await wait(400);
    } else if (file) {
      const cups = await checkCups();
      if (!cups.defaultDestination) {
        throw new Error(
          "PRINTER_NO_DEFAULT_DESTINATION: no CUPS default printer — run `lpadmin -d <printer>`",
        );
      }
      const requestId = await printFile(file, {
        title: `Print Kiosk ${config.kioskId}`,
        copies: job.copies,
        duplex: job.duplex,
      });
      log.info("job submitted to CUPS", {
        kioskId: config.kioskId,
        printJobId: job.printJobId,
        cupsRequestId: requestId,
      });
      await waitForCompletion(requestId);
    }
    status(job.printJobId, "PRINT_SUCCESS");
    log.info("job print success", { kioskId: config.kioskId, printJobId: job.printJobId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Kiosk job failed";
    log.error("job failed", { kioskId: config.kioskId, printJobId: job.printJobId, error: message });
    const event = /^PRINTER_|PRINTER_USB_TIMEOUT/.test(message) ? "PRINTER_ERROR" : "ERROR";
    status(job.printJobId, event, message);
  } finally {
    // Temp dir empty after success AND failure — both raw and converted paths.
    for (const t of temps) removeTempFile(t);
    activeJob = null;
  }
}

function connect(): void {
  socket = io(config.serverUrl, {
    auth: { role: "kiosk", kioskId: config.kioskId, token: config.kioskToken },
    transports: ["websocket"],
    reconnection: true,
  });

  socket.on("connect", () => {
    log.info("kiosk connected", { kioskId: config.kioskId });
    // Reconnect reconcile (issue #15): re-emit the last known phase so the
    // backend sees signs of life and the watchdog doesn't fire. No duplicate
    // prints — this only reports state, the pipeline keeps running once.
    if (everConnected && activeJob && lastPhase) {
      status(activeJob, lastPhase, "kiosk reconnected, resuming");
    }
    everConnected = true;
  });

  socket.on("connect_error", (err: Error) => {
    log.warn("kiosk connect_error, retrying", { kioskId: config.kioskId, error: err.message });
  });

  socket.on(SOCKET_EVENTS.KIOSK_ENROLLED, (msg: { kioskId: string; token: string }) => {
    saveToken(msg.token);
    log.info("kiosk enrolled, token saved", { kioskId: msg.kioskId, tokenFile: config.tokenFile });
    if (socket) socket.auth = { role: "kiosk", kioskId: config.kioskId, token: msg.token };
  });

  socket.on(SOCKET_EVENTS.NEW_PRINT_JOB, (msg: unknown) => {
    if (!isPrintJobPayload(msg, config.kioskId)) {
      log.warn("ignoring invalid job payload", { kioskId: config.kioskId });
      return;
    }
    if (activeJob !== null) {
      log.warn("busy, rejecting second job", { kioskId: config.kioskId, printJobId: msg.printJobId, activeJob });
      status(msg.printJobId, "ERROR", "Kiosk is already processing another job");
      return;
    }
    log.info("job received", { kioskId: config.kioskId, printJobId: msg.printJobId, copies: msg.copies });
    void processJob(msg);
  });
}

connect();
