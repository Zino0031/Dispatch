import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashKioskToken(token: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(token, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyKioskToken(token: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(token, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}