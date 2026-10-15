import type { Server as SocketIOServer, Socket } from "socket.io";
import { jobRoom, kioskRoom } from "./config.js";
import {
  isKioskOnline,
  listOnlineKiosks,
  onlineKioskCount,
  registerKiosk,
  unregisterKiosk,
  authenticateOrEnrollKiosk,
} from "./kioskRegistry.js";
import {
  KIOSK_STATUS_EVENTS,
  type KioskStatusEvent,
  type KioskStatusPayload,
  type NewPrintJobPayload,
} from "./types.js";
import { jobStore } from "./jobs/jobStore.js";

function isStatusEvent(value: string): value is KioskStatusEvent {
  return (KIOSK_STATUS_EVENTS as readonly string[]).includes(value);
}

export function attachSocketServer(io: SocketIOServer): void {
  io.use(async (socket, next) => {
    const auth = socket.handshake.auth as Record<string, unknown>;
    const role = typeof auth.role === "string" ? auth.role : "kiosk";

    if (role === "user") {
      const printJobId =
        typeof auth.printJobId === "string" ? auth.printJobId.trim() : "";
      if (!printJobId) {
        next(new Error("printJobId is required for user connections"));
        return;
      }
      socket.data.role = "user";
      socket.data.printJobId = printJobId;
      next();
      return;
    }

    const kioskId = typeof auth.kioskId === "string" ? auth.kioskId.trim() : "";
    const token = typeof auth.token === "string" ? auth.token : "";
    const authentication = kioskId
      ? await authenticateOrEnrollKiosk(kioskId, token)
      : { authenticated: false };
    if (!kioskId || !authentication.authenticated) {
      next(new Error("Invalid kiosk credentials"));
      return;
    }

    socket.data.role = "kiosk";
    socket.data.kioskId = kioskId;
    socket.data.issuedToken = authentication.issuedToken;
    next();
  });

  io.on("connection", (socket: Socket) => {
    if (socket.data.role === "user") {
      const printJobId = socket.data.printJobId as string;
      void socket.join(jobRoom(printJobId));
      return;
    }

    const kioskId = socket.data.kioskId as string;
    registerKiosk(io, kioskId, socket.id);
    void socket.join(kioskRoom(kioskId));
    console.log(`Kiosk connected: ${kioskId} (${socket.id})`);
    if (socket.data.issuedToken) {
      socket.emit("KIOSK_ENROLLED", { kioskId, token: socket.data.issuedToken });
    }

    socket.on("kiosk_status", (payload: KioskStatusPayload) => {
      if (
        !payload ||
        typeof payload.printJobId !== "string" ||
        !isStatusEvent(payload.event)
      ) {
        return;
      }

      const job = jobStore.get(payload.printJobId);
      if (!job || job.kioskId !== kioskId) {
        return;
      }

      jobStore.updateStatus(payload.printJobId, payload.event, payload.message);

      io.to(jobRoom(payload.printJobId)).emit("JOB_STATUS", {
        printJobId: payload.printJobId,
        kioskId,
        event: payload.event,
        message: payload.message,
        at: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      unregisterKiosk(kioskId, socket.id);
      console.log(`Kiosk disconnected: ${kioskId} (${socket.id})`);
    });
  });
}

export function emitNewPrintJob(
  io: SocketIOServer,
  payload: NewPrintJobPayload,
): void {
  io.to(kioskRoom(payload.kioskId)).emit("NEW_PRINT_JOB", payload);
  jobStore.updateStatus(payload.printJobId, "SENT_TO_KIOSK");
  io.to(jobRoom(payload.printJobId)).emit("JOB_STATUS", {
    printJobId: payload.printJobId,
    kioskId: payload.kioskId,
    event: "SENT_TO_KIOSK",
    at: new Date().toISOString(),
  });
}

export { isKioskOnline, listOnlineKiosks, onlineKioskCount };
