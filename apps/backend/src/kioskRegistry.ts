import type { Server as SocketIOServer } from "socket.io";
import { randomBytes } from "node:crypto";
import { config } from "./config.js";
import type { RegisteredKiosk } from "./types.js";
import type { KioskSettings } from "./types.js";
import { getSupabaseAdmin } from "./supabase.js";
import { hashKioskToken, verifyKioskToken } from "./kioskAuth.js";

const kiosks = new Map<string, RegisteredKiosk>();
const kioskSettings = new Map<string, KioskSettings>();

export async function hydrateKioskSettings(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("kiosks")
    .select("kiosk_id, display_name, auth_token_hash, revoked_at, last_seen_at");
  if (error) {
    console.error("Could not load kiosk settings from Supabase:", error.message);
    return;
  }

  kioskSettings.clear();
  for (const setting of data ?? []) {
    if (typeof setting.auth_token_hash !== "string") continue;
    kioskSettings.set(setting.kiosk_id, {
      kioskId: setting.kiosk_id,
      displayName: setting.display_name,
      authTokenHash: setting.auth_token_hash,
      revokedAt: setting.revoked_at ?? undefined,
      lastSeenAt: setting.last_seen_at ?? undefined,
    });
  }
}

export async function authenticateKiosk(kioskId: string, token: string): Promise<boolean> {
  const setting = kioskSettings.get(kioskId);
  if (setting) return !setting.revokedAt && verifyKioskToken(token, setting.authTokenHash);

  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("kiosks")
    .select("kiosk_id, display_name, auth_token_hash, revoked_at, last_seen_at")
    .eq("kiosk_id", kioskId)
    .maybeSingle();
  if (error || !data || typeof data.auth_token_hash !== "string" || data.revoked_at) return false;

  const valid = verifyKioskToken(token, data.auth_token_hash);
  if (valid) {
    kioskSettings.set(kioskId, {
      kioskId,
      displayName: data.display_name,
      authTokenHash: data.auth_token_hash,
      revokedAt: data.revoked_at ?? undefined,
      lastSeenAt: data.last_seen_at ?? undefined,
    });
    void supabase.from("kiosks").update({ last_seen_at: new Date().toISOString() }).eq("kiosk_id", kioskId);
  }
  return valid;
}

export async function authenticateOrEnrollKiosk(
  kioskId: string,
  token: string,
): Promise<{ authenticated: boolean; issuedToken?: string }> {
  if (token) return { authenticated: await authenticateKiosk(kioskId, token) };
  if (!config.autoEnrollKiosks) return { authenticated: false };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { authenticated: false };
  const { data: existing, error: lookupError } = await supabase
    .from("kiosks")
    .select("display_name, auth_token_hash, revoked_at")
    .eq("kiosk_id", kioskId)
    .maybeSingle();
  if (lookupError || existing?.revoked_at) {
    return { authenticated: false };
  }

  const issuedToken = randomBytes(32).toString("base64url");
  const authTokenHash = hashKioskToken(issuedToken);
  const { error } = await supabase.from("kiosks").upsert({
    kiosk_id: kioskId,
    display_name: existing?.display_name ?? kioskId,
    auth_token_hash: authTokenHash,
    revoked_at: null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return { authenticated: false };

  await hydrateKioskSettings();
  return { authenticated: true, issuedToken };
}

export async function enrollKiosk(
  kioskId: string,
  displayName: string,
  enrollmentToken: string,
): Promise<string | undefined> {
  if (enrollmentToken !== config.kioskEnrollmentToken) return undefined;
  const supabase = getSupabaseAdmin();
  if (!supabase) return undefined;

  const token = randomBytes(32).toString("base64url");
  const authTokenHash = hashKioskToken(token);
  const { error } = await supabase.from("kiosks").upsert({
    kiosk_id: kioskId,
    display_name: displayName,
    auth_token_hash: authTokenHash,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  });
  if (error) return undefined;
  kioskSettings.set(kioskId, { kioskId, displayName, authTokenHash });
  return token;
}

export function registerKiosk(
  io: SocketIOServer,
  kioskId: string,
  socketId: string,
): void {
  const existing = kiosks.get(kioskId);
  if (existing && existing.socketId !== socketId) {
    io.sockets.sockets.get(existing.socketId)?.disconnect(true);
  }

  kiosks.set(kioskId, {
    kioskId,
    displayName: kioskSettings.get(kioskId)?.displayName ?? kioskId,
    socketId,
    connectedAt: new Date(),
  });
}

export function unregisterKiosk(kioskId: string, socketId: string): void {
  const existing = kiosks.get(kioskId);
  if (existing?.socketId === socketId) {
    kiosks.delete(kioskId);
  }
}

export function isKioskOnline(kioskId: string): boolean {
  return kiosks.has(kioskId);
}

export function listOnlineKiosks(): RegisteredKiosk[] {
  return [...kiosks.values()];
}

export async function updateKioskSettings(
  kioskId: string,
  updates: { displayName?: string },
): Promise<boolean> {
  const current = kioskSettings.get(kioskId);
  if (!current) {
    return false;
  }

  const next = {
    ...current,
    displayName: updates.displayName ?? current.displayName,
  };
  kioskSettings.set(kioskId, next);
  const registered = kiosks.get(kioskId);
  if (registered) {
    registered.displayName = next.displayName;
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("kiosks").upsert({
      kiosk_id: kioskId,
      display_name: next.displayName,
      auth_token_hash: next.authTokenHash,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Could not save kiosk settings to Supabase:", error.message);
      return false;
    }
  }
  return true;
}

export function onlineKioskCount(): number {
  return kiosks.size;
}

export function kioskStatuses(): Array<{
  kioskId: string;
  displayName: string;
  online: boolean;
  connectedAt?: string;
}> {
  return [...kioskSettings.values()].map(({ kioskId, displayName }) => {
    const registered = kiosks.get(kioskId);
    return {
      kioskId,
      displayName: registered?.displayName ?? displayName,
      online: Boolean(registered),
      connectedAt: registered?.connectedAt.toISOString(),
    };
  });
}
