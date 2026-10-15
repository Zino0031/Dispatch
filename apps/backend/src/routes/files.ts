import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { getJobs } from "../jobs/jobStore.js";
import { getKioskSettings } from "../kioskRegistry.js";
import { verifyKioskToken } from "../kioskAuth.js";

// Short-lived upload grants: upload response carries a fileToken so the
// uploader can preview BEFORE any job exists. Job tokens and kiosk
// credentials take over after dispatch. Grants expire after 15 min.
const GRANT_TTL_MS = 15 * 60 * 1000;
const grants = new Map<string, { token: Buffer; expires: number }>();

export function mintFileGrant(name: string): string {
  const token = randomBytes(24);
  grants.set(name, { token, expires: Date.now() + GRANT_TTL_MS });
  return token.toString("hex");
}

function checkGrant(name: string, presented: string): boolean {
  const g = grants.get(name);
  if (!g) return false;
  if (Date.now() > g.expires) {
    grants.delete(name);
    return false;
  }
  try {
    const p = Buffer.from(presented, "hex");
    return p.length === g.token.length && timingSafeEqual(p, g.token);
  } catch {
    return false;
  }
}

// Strict filename shape: uploads/<uuid>.<ext> only — no traversal, no dotfiles.
const NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/;

async function authorized(name: string, req: {
  header: (n: string) => string | undefined;
  query: Record<string, unknown>;
}): Promise<boolean> {
  const q = typeof req.query.token === "string" ? req.query.token : "";
  if (q && checkGrant(name, q)) return true;
  const h = req.header("x-file-token") ?? "";
  if (h && checkGrant(name, h)) return true;

  const store = getJobs();
  const jobs = await store.list();
  const referencing = jobs.filter((j) => j.fileUrl.endsWith(`/api/files/${name}`) || j.fileUrl.endsWith(`/uploads/${name}`));
  if (referencing.length === 0) return false;

  const jobToken = req.header("x-print-job-token") ?? "";
  if (jobToken) {
    for (const j of referencing) {
      if (await store.verifyAccess(j.printJobId, jobToken)) return true;
    }
  }
  const kioskId = req.header("x-kiosk-id") ?? "";
  const kioskToken = req.header("x-kiosk-token") ?? "";
  if (kioskId && kioskToken) {
    const settings = getKioskSettings(kioskId);
    if (settings && (await verifyKioskToken(kioskToken, settings.authTokenHash))) {
      if (referencing.some((j) => j.kioskId === kioskId)) return true;
    }
  }
  return false;
}

export function createFilesRouter(): Router {
  const router = Router();
  router.get("/files/:name", async (req, res) => {
    const name = req.params.name.toLowerCase();
    if (!NAME_RE.test(name)) return res.status(404).json({ error: "File not found" });
    if (!(await authorized(name, req))) {
      // Deliberately 404 (not 401/403) to avoid file oracle.
      return res.status(404).json({ error: "File not found" });
    }
    return res.sendFile(name, { root: "uploads", dotfiles: "deny" }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "File not found" });
    });
  });
  return router;
}

/** Derive the stored filename from a fileUrl this backend issued. */
export function fileNameFromUrl(fileUrl: string): string | null {
  const m = /\/(?:api\/files|uploads)\/([A-Za-z0-9.-]+)$/.exec(fileUrl);
  if (!m) return null;
  const name = m[1].toLowerCase();
  return NAME_RE.test(name) ? name : null;
}
