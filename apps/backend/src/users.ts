import { getJobs } from "./jobs/jobStore.js";

// Guest-code identity for the pilot (campus SSO later — issue #18).
// The code arrives as `x-user-id`; jobs carry it, quota counts pages
// (copies × pagesEstimate) in a rolling window, CANCELLED jobs excluded.
export const QUOTA_WINDOW_DAYS = 30;

export function quotaPages(): number {
  const v = Number(process.env.QUOTA_PAGES ?? 100);
  return Number.isFinite(v) && v > 0 ? v : 100;
}

export interface QuotaStatus {
  userId: string;
  quotaPages: number;
  usedPages: number;
  remainingPages: number;
  windowDays: number;
}

export async function quotaFor(userId: string, now = Date.now()): Promise<QuotaStatus> {
  const cutoff = now - QUOTA_WINDOW_DAYS * 24 * 3_600_000;
  const jobs = await getJobs().list();
  let used = 0;
  for (const j of jobs) {
    if (j.userId !== userId || j.status === "CANCELLED") continue;
    if (Date.parse(j.createdAt) < cutoff) continue;
    used += j.copies * (j.pagesEstimate ?? 1);
  }
  const quota = quotaPages();
  return { userId, quotaPages: quota, usedPages: used, remainingPages: Math.max(0, quota - used), windowDays: QUOTA_WINDOW_DAYS };
}

/** Pages this dispatch would add; null when it fits, otherwise the deficit. */
export async function overQuotaBy(userId: string, copies: number, pagesEstimate: number): Promise<number | null> {
  const q = await quotaFor(userId);
  const need = copies * Math.max(1, pagesEstimate);
  return need <= q.remainingPages ? null : need - q.remainingPages;
}
