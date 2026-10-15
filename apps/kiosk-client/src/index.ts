import { io, type Socket } from "socket.io-client";
import { config, saveToken } from "./config.js";
import { KIOSK_STATUS_EVENTS, SOCKET_EVENTS } from "./contracts.js";

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
let socket: Socket | null = null;

function status(printJobId: string, event: (typeof KIOSK_STATUS_EVENTS)[number], message?: string): void {
  socket?.emit(SOCKET_EVENTS.KIOSK_STATUS, { printJobId, event, message });
}

/** DRY_RUN pipeline: emit each status BEFORE the work so a crash leaves an
 * accurate last-status (docs/GUIDELINES.md). Real download → normalize → CUPS
 * lands in issues #6–#8. */
async function processJob(job: PrintJobPayload): Promise<void> {
  activeJob = job.printJobId;
  try {
    status(job.printJobId, "DOWNLOAD_START");
    await wait(300); // downloader.ts (issue #7): HTTP/S only, caps, 0o600, finally-cleanup.
    status(job.printJobId, "DOWNLOAD_COMPLETE");
    await wait(200); // documentNormalizer.ts (issue #6): LibreOffice DOC→PDF.
    status(job.printJobId, "PRINTING_STARTED");
    await wait(400); // printer.ts (issues #6, #8): require default destination, lp, lpstat poll.
    status(job.printJobId, "PRINT_SUCCESS");
  } catch (e) {
    status(job.printJobId, "ERROR", e instanceof Error ? e.message : "Kiosk job failed");
  } finally {
    activeJob = null;
    // Temp files deleted in finally (docs/PRD.md §5.5) — real paths in #7.
  }
}

function connect(): void {
  socket = io(config.serverUrl, {
    auth: { role: "kiosk", kioskId: config.kioskId, token: config.kioskToken },
    transports: ["websocket"],
    reconnection: true,
  });

  socket.on("connect", () => {
    // eslint-disable-next-line no-console
    console.log(`Kiosk connected: ${config.kioskId}`);
  });

  socket.on("connect_error", (err: Error) => {
    // eslint-disable-next-line no-console
    console.log(`connect_error (retrying): ${err.message}`);
  });

  socket.on(SOCKET_EVENTS.KIOSK_ENROLLED, (msg: { kioskId: string; token: string }) => {
    saveToken(msg.token);
    // eslint-disable-next-line no-console
    console.log(`enrolled as ${msg.kioskId}; token saved to ${config.tokenFile}`);
    if (socket) socket.auth = { role: "kiosk", kioskId: config.kioskId, token: msg.token };
  });

  socket.on(SOCKET_EVENTS.NEW_PRINT_JOB, (msg: unknown) => {
    if (!isPrintJobPayload(msg, config.kioskId)) {
      // eslint-disable-next-line no-console
      console.log("ignoring invalid job payload");
      return;
    }
    if (activeJob !== null) {
      status(msg.printJobId, "ERROR", "Kiosk is already processing another job");
      return;
    }
    void processJob(msg);
  });
}

connect();
