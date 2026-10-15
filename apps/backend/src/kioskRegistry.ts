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

export interface KioskPrinter {
  name: string;
  color: boolean;
  duplex: boolean;
  isDefault: boolean;
}

// Printers per kiosk. Unconfigured kiosks use legacy single-default behavior
// (lp without -d). Supabase persistence for printers lands with #9 follow-up.
const printers = new Map<string, KioskPrinter[]>();

export function getPrinters(kioskId: string): KioskPrinter[] {
  return printers.get(kioskId) ?? [];
}

export function setPrinters(kioskId: string, list: KioskPrinter[]): void {
  printers.set(kioskId, list);
}

/** Route by job options: color jobs need a color printer, duplex jobs a
 * duplex one; fallback to the default. Null when nothing can serve. */
export function selectPrinter(
  kioskId: string,
  opts: { color: "bw" | "color"; duplex: boolean },
): KioskPrinter | null {
  const list = getPrinters(kioskId);
  if (list.length === 0) return null; // legacy path — caller omits -d.
  const capable = list.filter(
    (p) => (opts.color === "bw" || p.color) && (!opts.duplex || p.duplex),
  );
  if (capable.length > 0) {
    return capable.find((p) => p.isDefault) ?? capable[0];
  }
  return list.find((p) => p.isDefault) ?? list[0] ?? null;
}

/** Admin overview shape: all known kiosks + online flag (docs/API.md). */
export function kioskStatuses(): (KioskStatus & { printers: KioskPrinter[] })[] {
  const ids = new Set([...settings.keys(), ...online.keys()]);
  return [...ids].map((kioskId) => {
    const s = settings.get(kioskId);
    const o = online.get(kioskId);
    return {
      kioskId,
      displayName: s?.displayName ?? kioskId,
      online: o !== undefined,
      printers: getPrinters(kioskId),
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
