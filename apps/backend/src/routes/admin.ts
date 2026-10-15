import { Router } from "express";
import { z } from "zod";
import { listJobs } from "../jobs/jobStore.js";
import { hashKioskToken, newKioskToken } from "../kioskAuth.js";
import {
  enrollKiosk,
  getKioskSettings,
  kioskStatuses,
  renameKiosk,
} from "../kioskRegistry.js";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "change-me-in-production";
const ENROLLMENT_TOKEN = process.env.KIOSK_ENROLLMENT_TOKEN ?? "change-me-in-production";

const enrollSchema = z.object({
  kioskId: z.string().min(1),
  displayName: z.string().min(1).max(80),
  enrollmentToken: z.string().min(1),
});

const renameSchema = z.object({
  displayName: z.string().min(1).max(80),
});

export function createAdminRouter(): Router {
  const router = Router();

  // Single shared admin token, no RBAC in v1 (docs/ARCHITECTURE.md §5).
  router.use((req, res, next) => {
    if (req.header("x-admin-token") !== ADMIN_TOKEN) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    next();
  });

  router.post("/admin/kiosks/enroll", async (req, res) => {
    const parsed = enrollSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid enroll payload" });
    }
    const { kioskId, displayName, enrollmentToken } = parsed.data;
    if (enrollmentToken !== ENROLLMENT_TOKEN) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    // One-time kiosk token; only its scrypt hash is stored (docs/ARCHITECTURE.md §5).
    const token = newKioskToken();
    enrollKiosk(kioskId, displayName, await hashKioskToken(token));
    return res.status(201).json({ kioskId, displayName, token });
  });

  router.get("/admin/overview", (_req, res) => {
    const kiosks = kioskStatuses();
    const jobs = listJobs().map((j) => {
      const { accessToken: _t, fileUrl: _f, ...safe } = j;
      void _t;
      void _f;
      return safe;
    });
    const active = jobs.filter(
      (j) => !["PRINT_SUCCESS", "ERROR", "PRINTER_ERROR", "CANCELLED"].includes(j.status),
    ).length;
    return res.json({
      kiosks,
      jobs,
      summary: {
        kiosksOnline: kiosks.filter((k) => k.online).length,
        jobsTotal: jobs.length,
        jobsActive: active,
      },
    });
  });

  router.patch("/admin/kiosks/:kioskId", (req, res) => {
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid displayName (1–80 chars)" });
    }
    if (!getKioskSettings(req.params.kioskId)) {
      return res.status(404).json({ error: "Kiosk unknown" });
    }
    renameKiosk(req.params.kioskId, parsed.data.displayName);
    return res.json({ kioskId: req.params.kioskId, displayName: parsed.data.displayName });
  });

  return router;
}
