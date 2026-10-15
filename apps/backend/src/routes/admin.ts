import { Router } from "express";
import { config } from "../config.js";
import { getSupabaseAdmin } from "../supabase.js";
import { enrollKiosk, kioskStatuses, updateKioskSettings } from "../kioskRegistry.js";
import { jobStore } from "../jobs/jobStore.js";

function isAdmin(req: { header(name: string): string | undefined }): boolean {
  return req.header("x-admin-token") === config.adminToken;
}

export function createAdminRouter(): Router {
  const router = Router();

  router.post("/kiosks/enroll", async (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }
    const kioskId = typeof req.body?.kioskId === "string" ? req.body.kioskId.trim() : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : kioskId;
    const enrollmentToken = typeof req.body?.enrollmentToken === "string" ? req.body.enrollmentToken : "";
    if (!kioskId || !displayName || !enrollmentToken) {
      res.status(400).json({ error: "kioskId, displayName, and enrollmentToken are required" });
      return;
    }
    const token = await enrollKiosk(kioskId, displayName, enrollmentToken);
    if (!token) {
      res.status(401).json({ error: "Invalid enrollment token or Supabase is not configured" });
      return;
    }
    res.status(201).json({ kioskId, displayName, token });
  });

  router.get("/overview", (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const jobs = jobStore.list();
    res.json({
      kiosks: kioskStatuses(),
      jobs: jobs.slice(0, 100).map(({ accessToken: _accessToken, fileUrl: _fileUrl, ...job }) => job),
      summary: {
        kiosksOnline: kioskStatuses().filter((kiosk) => kiosk.online).length,
        jobsTotal: jobs.length,
        jobsActive: jobs.filter((job) => !["PRINT_SUCCESS", "ERROR", "PRINTER_ERROR", "CANCELLED"].includes(job.status)).length,
      },
    });
  });

  router.patch("/kiosks/:kioskId", async (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const displayName =
      typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    if (!displayName || displayName.length > 80) {
      res.status(400).json({ error: "displayName must be between 1 and 80 characters" });
      return;
    }

    if (!getSupabaseAdmin()) {
      res.status(503).json({
        error: "Supabase is not configured; kiosk settings cannot be persisted",
      });
      return;
    }

    if (!(await updateKioskSettings(req.params.kioskId, {
      displayName,
    }))) {
      res.status(404).json({ error: "Kiosk is not configured" });
      return;
    }

    res.json({ kioskId: req.params.kioskId, displayName });
  });

  return router;
}