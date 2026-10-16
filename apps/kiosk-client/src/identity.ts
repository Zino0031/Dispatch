import { networkInterfaces } from "node:os";

export function getHardwareId(): string {
  const interfaces = networkInterfaces();
  const addresses = Object.values(interfaces).flatMap((items) => items ?? []);
  const physicalMac = addresses.find(
    (address) => !address.internal && address.mac && address.mac !== "00:00:00:00:00:00",
  )?.mac;

  if (!physicalMac) {
    throw new Error("Could not detect a physical network MAC address");
  }

  return physicalMac.toLowerCase();
}

if (process.argv[1]?.endsWith("identity.ts")) {
  console.log(`KIOSK_ID=${getHardwareId()}`);
  console.log(`KIOSK_NAME=${getHardwareId()}`);
  console.log("Add this ID to the backend KIOSK_CREDENTIALS map before connecting.");
}