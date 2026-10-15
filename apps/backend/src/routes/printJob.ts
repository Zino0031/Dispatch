import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { emitNewPrintJob, isKioskOnline } from "../socket.js";
import { kioskStatuses } from "../kioskRegistry.js";
import { jobStore } from "../jobs/jobStore.js";
import { config } from "../config.js";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      void mkdir("uploads", { recursive: true }).then(
        () => callback(null, "uploads"),
        (error) => callback(error, "uploads"),
      );
    },
    filename: (_req, file, callback) => {
      const extension = file.originalname.includes(".")
        ? file.originalname.slice(file.originalname.lastIndexOf("."))
        : "";
      callback(null, `${randomUUID()}${extension.toLowerCase()}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, allowedMimeTypes.has(file.mimetype));
  },
});

const printJobBodySchema = z.object({
  kioskId: z.string().min(1),
  fileUrl: z.string().url(),
  copies: z.number().int().min(1).max(50),
  color: z.enum(["bw", "color"]),
  duplex: z.boolean(),
});

export function createPrintJobRouter(io: SocketIOServer): Router {
  const router = Router();

  router.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "A supported document file is required" });
      return;
    }

    res.status(201).json({
      fileUrl: `${config.publicUrl}/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  });

  router.get("/kiosks", (_req, res) => {
    res.json({
      kiosks: kioskStatuses().filter((kiosk) => kiosk.online),
    });
  });

  router.post("/print-job", (req, res) => {
    const parsed = printJobBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid print job payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { kioskId, fileUrl, copies, color, duplex } = parsed.data;
    if (!isKioskOnline(kioskId)) {
      res.status(503).json({ error: "Kiosk offline", kioskId });
      return;
    }

    const job = jobStore.create({
      kioskId,
      fileUrl,
      copies,
      color,
      duplex,
    });

    emitNewPrintJob(io, job);

    res.status(201).json({
      printJobId: job.printJobId,
      accessToken: job.accessToken,
      status: job.status,
    });
  });

  router.get("/print-job/:printJobId", (req, res) => {
    const job = jobStore.get(req.params.printJobId);
    const accessToken = req.header("x-print-job-token");
    if (!job || !accessToken || !jobStore.canAccess(job.printJobId, accessToken)) {
      res.status(404).json({ error: "Print job not found" });
      return;
    }

    res.json({
      printJobId: job.printJobId,
      kioskId: job.kioskId,
      copies: job.copies,
      color: job.color,
      duplex: job.duplex,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      history: job.history,
    });
  });

  return router;
}
