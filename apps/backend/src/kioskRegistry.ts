export interface KioskStatus {
  kioskId: string;
  displayName: string;
  online: boolean;
  connectedAt?: string;
}

// Ephemeral online map — entries join kioskSettings in kioskStatuses().
const online = new Map<string, { connectedAt: string }>();

// Enrolled kiosk settings. In-memory until Supabase persistence (issue #9);
// Supabase stores kiosk credentials/settings only (docs/ARCHITECTURE.md).
const settings = new Map<string, { displayName: string; authTokenHash: string }>();

export function setKioskOnline(kioskId: string): void {
  online.set(kioskId, { connectedAt: new Date().toISOString() });
}

export function setKioskOffline(kioskId: string): void {
  online.delete(kioskId);
}

export function enrollKiosk(kioskId: string, displayName: string, authTokenHash: string): void {
  settings.set(kioskId, { displayName, authTokenHash });
}

export function getKioskSettings(
  kioskId: string,
): { displayName: string; authTokenHash: string } | undefined {
  return settings.get(kioskId);
}

export function renameKiosk(kioskId: string, displayName: string): boolean {
  const s = settings.get(kioskId);
  if (!s) return false;
  settings.set(kioskId, { ...s, displayName });
  return true;
}

/** Admin overview shape: all known kiosks + online flag (docs/API.md). */
export function kioskStatuses(): KioskStatus[] {
  const ids = new Set([...settings.keys(), ...online.keys()]);
  return [...ids].map((kioskId) => {
    const s = settings.get(kioskId);
    const o = online.get(kioskId);
    return {
      kioskId,
      displayName: s?.displayName ?? kioskId,
      online: o !== undefined,
      ...(o ? { connectedAt: o.connectedAt } : {}),
    };
  });
}

/** Public listing: online-only kiosks (docs/API.md, docs/PRD.md §5.2). */
export function onlineKiosks(): KioskStatus[] {
  return kioskStatuses().filter((k) => k.online);
}

export function isKioskOnline(kioskId: string): boolean {
  return online.has(kioskId);
}
