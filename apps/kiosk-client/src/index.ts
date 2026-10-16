import "dotenv/config";
import { rm, writeFile } from "node:fs/promises";
import { io } from "socket.io-client";
import { config } from "./config.js";
import { downloadDocument } from "./downloader.js";
import { printWithCups } from "./printer.js";
import { normalizeForPrinting } from "./documentNormalizer.js";
import type { KioskStatusEvent, NewPrintJobPayload } from "./types.js";

const socket = io(config.serverUrl, {
  auth: { role: "kiosk", kioskId: config.kioskId, token: config.kioskToken },
  reconnection: true,
  transports: ["websocket"],
});

socket.on("KIOSK_ENROLLED", async (payload: unknown) => {
  if (!payload || typeof payload !== "object") return;
  const enrollment = payload as { kioskId?: unknown; token?: unknown };
  if (enrollment.kioskId !== config.kioskId || typeof enrollment.token !== "string") return;

  await writeFile(config.tokenFile, enrollment.token, { mode: 0o600 });
  config.kioskToken = enrollment.token;
  socket.auth = { role: "kiosk", kioskId: config.kioskId, token: enrollment.token };
  console.log(`Kiosk enrolled automatically. Credential saved to ${config.tokenFile}`);
});

let activeJob = false;

function isPrintJobPayload(value: unknown): value is NewPrintJobPayload {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<NewPrintJobPayload>;
  return (
    typeof job.printJobId === "string" &&
    job.kioskId === config.kioskId &&
    typeof job.fileUrl === "string" &&
    Number.isInteger(job.copies) &&
    (job.color === "bw" || job.color === "color") &&
    typeof job.duplex === "boolean"
  );
}

function emitStatus(printJobId: string, event: KioskStatusEvent, message?: string): void {
  socket.emit("kiosk_status", { printJobId, event, message });
}

socket.on("connect", () => {
  console.log(`Kiosk "${config.kioskId}" connected (${socket.id})`);
});

socket.on("connect_error", (error) => {
  console.error(
    `Kiosk connection failed for ID "${config.kioskId}": ${error.message}`,
  );
  if (error.message === "Invalid kiosk credentials") {
    console.error(
      `Ensure AUTO_ENROLL_KIOSKS=true for first boot, or provide a valid KIOSK_TOKEN for ${config.kioskId}.`,
    );
  }
});

socket.on("NEW_PRINT_JOB", (payload: unknown) => {
  if (!isPrintJobPayload(payload)) {
    console.error("Ignoring invalid print job payload");
    return;
  }
  if (activeJob) {
    emitStatus(payload.printJobId, "ERROR", "Kiosk is already processing another job");
    return;
  }

  activeJob = true;
  void processJob(payload).finally(() => {
    activeJob = false;
  });
});

async function processJob(job: NewPrintJobPayload): Promise<void> {
  let filePath: string | undefined;
  let printablePath: string | undefined;
  try {
    emitStatus(job.printJobId, "DOWNLOAD_START");
    filePath = await downloadDocument(
      job.fileUrl,
      config.tempDir,
      job.printJobId,
      config.maxDownloadBytes,
      config.downloadTimeoutMs,
    );
    console.log(`Downloaded document for job ${job.printJobId}: ${filePath}`);
    emitStatus(job.printJobId, "DOWNLOAD_COMPLETE");
    printablePath = await normalizeForPrinting(filePath);
    emitStatus(job.printJobId, "PRINTING_STARTED");
    await printWithCups(printablePath, {
      copies: job.copies,
      color: job.color,
      duplex: job.duplex,
      jobId: job.printJobId,
    });
    emitStatus(job.printJobId, "PRINT_SUCCESS");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown kiosk error";
    emitStatus(job.printJobId, message.includes("CUPS") ? "PRINTER_ERROR" : "ERROR", message);
    console.error(`Job ${job.printJobId} failed:`, message);
  } finally {
    if (filePath) {
      await rm(filePath, { force: true });
    }
    if (printablePath && printablePath !== filePath) {
      await rm(printablePath, { force: true });
    }
  }
}

process.once("SIGTERM", () => socket.close());
process.once("SIGINT", () => socket.close());