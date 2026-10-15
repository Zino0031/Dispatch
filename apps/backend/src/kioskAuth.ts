import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt);

/** scrypt hash stored as `salt:hash` (docs/ARCHITECTURE.md §5). */
export async function hashKioskToken(token: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(token, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyKioskToken(token: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(token, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** One-time kiosk token: 32-byte base64url (docs/SOCKET_PROTOCOL.md). */
export function newKioskToken(): string {
  return randomBytes(32).toString("base64url");
}
