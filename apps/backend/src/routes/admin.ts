import { Router } from "express";
import { z } from "zod";
import { getJobs } from "../jobs/jobStore.js";
import { log } from "../logger.js";
import { computeMetrics } from "../metrics.js";
import { hashKioskToken, newKioskToken } from "../kioskAuth.js";
import {
  enrollKiosk,
  getKioskSettings,
  getPrinters,
  kioskStatuses,
  renameKiosk,
  setPrinters,
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

const printerSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.boolean(),
  duplex: z.boolean(),
  isDefault: z.boolean(),
});

export function createAdminRouter(): Router {
  const router = Router();

  // Single shared admin token, no RBAC in v1 (docs/ARCHITECTURE.md §5).
  // Scoped to /admin so the file proxy and job routes are unaffected.
  router.use("/admin", (req, res, next) => {
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
    log.info("kiosk enrolled", { kioskId });
    return res.status(201).json({ kioskId, displayName, token });
  });

  router.get("/admin/overview", async (req, res) => {
    const kiosks = kioskStatuses();
    const all = await getJobs().list();
    const days = windowDays(req);
    const jobs = all.map((j) => {
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
      jobs: jobs.slice(0, 100),
      metrics: computeMetrics(all, new Set(kiosks.filter((k) => k.online).map((k) => k.kioskId)), days),
      summary: {
        kiosksOnline: kiosks.filter((k) => k.online).length,
        jobsTotal: jobs.length,
        jobsActive: active,
      },
    });
  });

  // CSV export for staff (no secrets — same stripped shape as overview).
  router.get("/admin/metrics.csv", async (req, res) => {
    const days = windowDays(req);
    const all = await getJobs().list();
    const cutoff = days === null ? 0 : Date.now() - days * 86_400_000;
    const rows = all.filter((j) => Date.parse(j.createdAt) >= cutoff);
    const esc = (v: string | number | boolean): string => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      "printJobId,kioskId,copies,color,duplex,status,createdAt,updatedAt",
      ...rows.map((j) =>
        [j.printJobId, j.kioskId, j.copies, j.color, j.duplex, j.status, j.createdAt, j.updatedAt]
          .map(esc)
          .join(","),
      ),
    ];
    res.header("Content-Type", "text/csv");
    res.send(lines.join("\n"));
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

  router.get("/admin/kiosks/:kioskId/printers", (req, res) => {
    if (!getKioskSettings(req.params.kioskId)) {
      return res.status(404).json({ error: "Kiosk unknown" });
    }
    return res.json({ kioskId: req.params.kioskId, printers: getPrinters(req.params.kioskId) });
  });

  router.put("/admin/kiosks/:kioskId/printers", (req, res) => {
    if (!getKioskSettings(req.params.kioskId)) {
      return res.status(404).json({ error: "Kiosk unknown" });
    }
    const parsed = z.array(printerSchema).max(16).safeParse(req.body?.printers ?? req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid printers (name/color/duplex/isDefault)" });
    }
    const names = parsed.data.map((p) => p.name);
    if (new Set(names).size !== names.length) {
      return res.status(400).json({ error: "Printer names must be unique per kiosk" });
    }
    const list = parsed.data.map((p) => ({ ...p }));
    const defaults = list.filter((p) => p.isDefault);
    if (defaults.length > 1) {
      return res.status(400).json({ error: "Exactly one default printer" });
    }
    if (list.length > 0 && defaults.length === 0) list[0].isDefault = true;
    setPrinters(req.params.kioskId, list);
    return res.json({ kioskId: req.params.kioskId, printers: list });
  });

  return router;
}

function windowDays(req: { query: unknown }): number | null {
  const parsed = z
    .object({ days: z.coerce.number().int().min(1).max(365).optional() })
    .safeParse(req.query);
  return parsed.success ? (parsed.data.days ?? null) : null;
}
