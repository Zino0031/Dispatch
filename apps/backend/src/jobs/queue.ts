/** Per-kiosk FIFO queue (issue #12, decision: FIFO with cancel, bounded).
 * Kiosks still process one job at a time; the backend holds the rest as
 * QUEUED and hands the next job over on terminal status. Ephemeral like
 * presence (restart drops queue positions; Supabase jobs keep status). */
const active = new Map<string, string>(); // kioskId -> printJobId being printed
const pending = new Map<string, string[]>(); // kioskId -> queued printJobIds (FIFO)

function queueFor(kioskId: string): string[] {
  let q = pending.get(kioskId);
  if (!q) {
    q = [];
    pending.set(kioskId, q);
  }
  return q;
}

/** Enqueue; returns jobs ahead (0 = next to print). */
export function enqueue(kioskId: string, printJobId: string): number {
  const q = queueFor(kioskId);
  if (!q.includes(printJobId) && active.get(kioskId) !== printJobId) q.push(printJobId);
  const ahead = (active.has(kioskId) ? 1 : 0) + q.indexOf(printJobId);
  return ahead;
}

/** Kiosk idle when online (checked by caller) and nothing active. */
export function isIdle(kioskId: string): boolean {
  return !active.has(kioskId);
}

export function markSent(kioskId: string, printJobId: string): void {
  const q = queueFor(kioskId);
  const i = q.indexOf(printJobId);
  if (i >= 0) q.splice(i, 1);
  active.set(kioskId, printJobId);
}

/** Terminal status on the active job -> hand over next queued job (if any). */
export function completeActive(kioskId: string, printJobId: string): string | null {
  if (active.get(kioskId) !== printJobId) return active.get(kioskId) ?? null;
  active.delete(kioskId);
  return queueFor(kioskId)[0] ?? null;
}

/** Jobs ahead of this job (0 = with the kiosk now). -1 when unknown. */
export function positionOf(kioskId: string, printJobId: string): number {
  if (active.get(kioskId) === printJobId) return 0;
  const q = queueFor(kioskId);
  const i = q.indexOf(printJobId);
  if (i < 0) return -1;
  return (active.has(kioskId) ? 1 : 0) + i;
}

/** Remove a QUEUED job (cancel path). Returns true when removed. */
export function dequeue(kioskId: string, printJobId: string): boolean {
  const q = queueFor(kioskId);
  const i = q.indexOf(printJobId);
  if (i < 0) return false;
  q.splice(i, 1);
  return true;
}

/** Positions of all waiting jobs (for fan-out after dequeue/advance). */
export function waiting(kioskId: string): string[] {
  return [...queueFor(kioskId)];
}
