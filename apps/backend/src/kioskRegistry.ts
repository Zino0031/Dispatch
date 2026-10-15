export interface KioskStatus {
  kioskId: string;
  displayName: string;
  online: boolean;
  connectedAt?: string;
}

// Ephemeral online map — hydrated from sockets in later issues.
// (Full registry with Supabase hydrate lives in issues #9+.)
const online = new Map<string, { displayName: string; connectedAt: string }>();

export function setKioskOnline(kioskId: string, displayName: string): void {
  online.set(kioskId, { displayName, connectedAt: new Date().toISOString() });
}

export function setKioskOffline(kioskId: string): void {
  online.delete(kioskId);
}

/** All known statuses (online flag per kiosk). Admin overview uses this shape. */
export function kioskStatuses(): KioskStatus[] {
  return [...online.entries()].map(([kioskId, v]) => ({ kioskId, ...v, online: true }));
}

/** Public listing: online-only kiosks (docs/API.md, docs/PRD.md §5.2). */
export function onlineKiosks(): KioskStatus[] {
  return kioskStatuses().filter((k) => k.online);
}

export function isKioskOnline(kioskId: string): boolean {
  return online.has(kioskId);
}
