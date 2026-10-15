import { networkInterfaces } from "node:os";

/** Stable machine id from the first non-internal MAC (docs/OPERATIONS.md). */
export function getHardwareId(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const nic of ifaces ?? []) {
      if (!nic.internal && nic.mac && nic.mac !== "00:00:00:00:00:00") {
        return `kiosk-${nic.mac.replace(/:/g, "")}`;
      }
    }
  }
  return `kiosk-${process.env.HOSTNAME ?? "unknown"}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(getHardwareId());
}
