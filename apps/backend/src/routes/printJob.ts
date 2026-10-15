import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import type { Server } from "socket.io";
import { z } from "zod";
import { MAX_FILE_BYTES } from "../contracts.js";
import { getJobs } from "../jobs/jobStore.js";
import { freeBytes } from "../disk.js";
import { mintFileGrant } from "./files.js";
import { isKioskOnline } from "../kioskRegistry.js";
import { emitNewPrintJob } from "../socket.js";

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
});

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
    const { kioskId } = parsed.data;
    if (!isKioskOnline(kioskId)) {
      return res.status(503).json({ error: "Kiosk offline", kioskId });
    }
    const store = getJobs();
    const job = await store.create(parsed.data);
    if (io) {
      await emitNewPrintJob(io, {
        printJobId: job.printJobId,
        kioskId: job.kioskId,
        fileUrl: job.fileUrl,
        copies: job.copies,
        color: job.color,
        duplex: job.duplex,
      });
      const current = await store.get(job.printJobId);
      return res
        .status(201)
        .json({ printJobId: job.printJobId, accessToken: job.accessToken, status: current?.status ?? job.status });
    }
    await store.updateStatus(job.printJobId, "SENT_TO_KIOSK");
    return res
      .status(201)
      .json({ printJobId: job.printJobId, accessToken: job.accessToken, status: "SENT_TO_KIOSK" });
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
    return res.json(safe);
  });

  return router;
}
