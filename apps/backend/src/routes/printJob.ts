import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import type { Server } from "socket.io";
import { z } from "zod";
import { MAX_FILE_BYTES, SOCKET_EVENTS, jobRoom } from "../contracts.js";
import { getJobs } from "../jobs/jobStore.js";
import { dequeue, enqueue, isIdle, positionOf } from "../jobs/queue.js";
import { freeBytes } from "../disk.js";
import { log } from "../logger.js";
import { mintFileGrant } from "./files.js";
import { attachJob, getIntent } from "../payments/pricing.js";
import { overQuotaBy } from "../users.js";
import { getPrinters, selectPrinter } from "../kioskRegistry.js";
import { isKioskOnline } from "../kioskRegistry.js";
import { dispatchToKiosk } from "../socket.js";

// Must stay in sync with web validateFile() (docs/PRD.md §5.1).
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: MAX_FILE_BYTES }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) return cb(null, true);
    return cb(new Error("That file type isn't supported. Upload a PDF, JPG, PNG, DOC or DOCX."));
  },
});

const printJobSchema = z.object({
  kioskId: z.string().min(1),
  fileUrl: z.string().url(),
  copies: z.number().int().min(1).max(50),
  color: z.enum(["bw", "color"]),
  duplex: z.boolean(),
  paymentIntentId: z.string().min(1).optional(),
  pagesEstimate: z.number().int().min(1).max(1000).optional(),
});

// No job prints without a confirmed payment intent when enabled (issue #17).
// Pilot default off; flip REQUIRE_PAYMENT=true with a real provider.
const REQUIRE_PAYMENT = process.env.REQUIRE_PAYMENT === "true";

export function createPrintJobRouter(io?: Server): Router {
  const router = Router();

  router.post("/upload", (req, res) => {
    // Fail fast before multer writes: keep room for the biggest allowed file.
    if (freeBytes("uploads") < MAX_FILE_BYTES) {
      return res.status(507).json({ error: "Print service is low on disk space, try again later." });
    }
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        const status = message.includes("File too large") ? 400 : 400;
        return res.status(status).json({ error: message });
      }
      if (!req.file) return res.status(400).json({ error: "No file received." });
      if (req.file.size === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "That file is empty." });
      }
      // Store as uploads/<uuid>.<lowercased-ext> (docs/API.md).
      const ext = path.extname(req.file.originalname).toLowerCase();
      const stored = `${randomUUID()}${ext}`;
      fs.renameSync(req.file.path, path.join("uploads", stored));
      const base = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
      return res.status(201).json({
        fileUrl: `${base}/api/files/${stored}`,
        fileToken: mintFileGrant(stored),
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    });
  });

  router.post("/print-job", async (req, res) => {
    const parsed = printJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid print job payload", details: parsed.error.flatten() });
    }
    const { kioskId, paymentIntentId } = parsed.data;
    if (!isKioskOnline(kioskId)) {
      log.warn("dispatch rejected: kiosk offline", { kioskId });
      return res.status(503).json({ error: "Kiosk offline", kioskId });
    }
    if (REQUIRE_PAYMENT) {
      const intent = paymentIntentId ? getIntent(paymentIntentId) : undefined;
      if (!intent || intent.status !== "confirmed") {
        return res.status(402).json({ error: "Payment required before printing" });
      }
    }
    const store = getJobs();
    // Route to a capable printer when the kiosk has printers configured
    // (issue #19); unconfigured kiosks use the legacy CUPS default.
    const routed = selectPrinter(kioskId, { color: parsed.data.color, duplex: parsed.data.duplex });
    if (getPrinters(kioskId).length > 0 && !routed) {
      return res.status(503).json({ error: "No printer available on this kiosk", kioskId });
    }
    // Guest-code quota (issue #18): 429 with a clear pre-payment block.
    const userId = req.header("x-user-id")?.trim() || undefined;
    if (userId) {
      const over = await overQuotaBy(userId, parsed.data.copies, parsed.data.pagesEstimate ?? 1);
      if (over !== null) {
        return res.status(429).json({ error: `Over quota: short ${over} pages for the 30-day window`, userId });
      }
    }
    const job = await store.create({ ...parsed.data, userId, ...(routed ? { printer: routed.name } : {}) });
    if (paymentIntentId) attachJob(paymentIntentId, job.printJobId);
    // FIFO per kiosk (issue #12): hand over immediately when idle,
    // otherwise hold as QUEUED with a position.
    const ahead = enqueue(job.kioskId, job.printJobId);
    if (io && isIdle(job.kioskId)) {
      await dispatchToKiosk(io, {
        printJobId: job.printJobId,
        kioskId: job.kioskId,
        fileUrl: job.fileUrl,
        copies: job.copies,
        color: job.color,
        duplex: job.duplex,
        ...(job.printer ? { printer: job.printer } : {}),
      });
      log.info("print-job created", { printJobId: job.printJobId, kioskId: job.kioskId, status: "SENT_TO_KIOSK", position: 0 });
      return res
        .status(201)
        .json({ printJobId: job.printJobId, accessToken: job.accessToken, status: "SENT_TO_KIOSK", position: 0 });
    }
    if (io) {
      io.to(jobRoom(job.printJobId)).emit(SOCKET_EVENTS.JOB_STATUS, {
        printJobId: job.printJobId,
        kioskId: job.kioskId,
        event: "QUEUED",
        position: ahead,
        at: job.updatedAt,
      });
    } else {
      await store.updateStatus(job.printJobId, "SENT_TO_KIOSK");
      return res
        .status(201)
        .json({ printJobId: job.printJobId, accessToken: job.accessToken, status: "SENT_TO_KIOSK", position: 0 });
    }
    log.info("print-job created", { printJobId: job.printJobId, kioskId: job.kioskId, status: "QUEUED", position: ahead });
    return res
      .status(201)
      .json({ printJobId: job.printJobId, accessToken: job.accessToken, status: "QUEUED", position: ahead });
  });

  // Token-gated read: wrong/missing token or unknown id → 404 (no id oracle).
  router.get("/print-job/:printJobId", async (req, res) => {
    const token = req.header("x-print-job-token") ?? "";
    const job = await getJobs().verifyAccess(req.params.printJobId, token);
    if (!job) {
      return res.status(404).json({ error: "Print job not found" });
    }
    const { accessToken: _t, fileUrl: _f, ...safe } = job;
    void _t;
    void _f;
    return res.json({ ...safe, position: positionOf(job.kioskId, job.printJobId) });
  });

  // Cancel a QUEUED (not yet sent) job. Active/sent jobs → 409.
  router.delete("/print-job/:printJobId", async (req, res) => {
    const token = req.header("x-print-job-token") ?? "";
    const store = getJobs();
    const job = await store.verifyAccess(req.params.printJobId, token);
    if (!job) {
      return res.status(404).json({ error: "Print job not found" });
    }
    if (job.status !== "QUEUED" || !dequeue(job.kioskId, job.printJobId)) {
      return res.status(409).json({ error: "Only queued jobs can be cancelled" });
    }
    const updated = await store.updateStatus(job.printJobId, "CANCELLED", "Cancelled by user");
    return res.json({ printJobId: job.printJobId, status: updated?.status ?? "CANCELLED" });
  });

  return router;
}
