import type { Server, Socket } from "socket.io";
import {
  KIOSK_STATUS_EVENTS,
  SOCKET_EVENTS,
  jobRoom,
  kioskRoom,
  type PrintJobStatus,
} from "./contracts.js";
import { enrollKiosk, getKioskSettings, setKioskOffline, setKioskOnline } from "./kioskRegistry.js";
import { hashKioskToken, newKioskToken, verifyKioskToken } from "./kioskAuth.js";
import { getJobs } from "./jobs/jobStore.js";

const AUTO_ENROLL = process.env.AUTO_ENROLL_KIOSKS === "true";

interface KioskAuth {
  role?: string;
  kioskId?: string;
  token?: string;
}

interface UserAuth {
  role?: string;
  printJobId?: string;
}

// Latest socket per kiosk wins; older socket force-disconnected.
const kioskSockets = new Map<string, Socket>();

function registerKiosk(kioskId: string, socket: Socket): void {
  const prev = kioskSockets.get(kioskId);
  if (prev && prev.id !== socket.id) {
    prev.disconnect(true);
  }
  kioskSockets.set(kioskId, socket);
  setKioskOnline(kioskId);
}

function unregisterKiosk(kioskId: string, socket: Socket): void {
  if (kioskSockets.get(kioskId)?.id === socket.id) {
    kioskSockets.delete(kioskId);
    setKioskOffline(kioskId);
  }
}

export async function emitNewPrintJob(
  io: Server,
  job: { printJobId: string; kioskId: string; fileUrl: string; copies: number; color: string; duplex: boolean },
): Promise<void> {
  io.to(kioskRoom(job.kioskId)).emit(SOCKET_EVENTS.NEW_PRINT_JOB, job);
  const updated = await getJobs().updateStatus(job.printJobId, "SENT_TO_KIOSK");
  if (updated) {
    io.to(jobRoom(job.printJobId)).emit(SOCKET_EVENTS.JOB_STATUS, {
      printJobId: job.printJobId,
      kioskId: job.kioskId,
      event: "SENT_TO_KIOSK",
      at: updated.updatedAt,
    });
  }
}

export function setupSocket(io: Server): void {
  io.use(async (socket, next) => {
    const auth = socket.handshake.auth as KioskAuth & UserAuth;
    if (auth.role === "user") {
      if (!auth.printJobId) return next(new Error("Missing printJobId"));
      // No token check in v1 (known gap — issue #13).
      return next();
    }
    // Kiosk role (default).
    const kioskId = auth.kioskId ?? "";
    if (!kioskId) return next(new Error("Invalid kiosk credentials"));
    const settings = getKioskSettings(kioskId);
    const token = auth.token ?? "";
    if (!token && AUTO_ENROLL && settings === undefined) {
      // Auto-enroll on first connect: issue token once, never log it.
      const fresh = newKioskToken();
      enrollKiosk(kioskId, kioskId, await hashKioskToken(fresh));
      socket.emit(SOCKET_EVENTS.KIOSK_ENROLLED, { kioskId, token: fresh });
      return next();
    }
    if (!settings || !token || !(await verifyKioskToken(token, settings.authTokenHash))) {
      return next(new Error("Invalid kiosk credentials"));
    }
    return next();
  });

  io.on("connection", (socket) => {
    const auth = socket.handshake.auth as KioskAuth & UserAuth;
    if (auth.role === "user") {
      const printJobId = auth.printJobId as string;
      void socket.join(jobRoom(printJobId));
      // Replay history so late joiners still see the full timeline.
      void getJobs()
        .get(printJobId)
        .then((job) => {
          for (const h of job?.history ?? []) {
            socket.emit(SOCKET_EVENTS.JOB_STATUS, {
              printJobId,
              kioskId: job?.kioskId,
              event: h.status,
              message: h.message,
              at: h.at,
            });
          }
        });
      return;
    }

    const kioskId = (auth as KioskAuth).kioskId as string;
    void socket.join(kioskRoom(kioskId));
    registerKiosk(kioskId, socket);

    socket.on(SOCKET_EVENTS.KIOSK_STATUS, (msg: unknown) => {
      const body = msg as { printJobId?: unknown; event?: unknown; message?: unknown };
      if (
        typeof body?.printJobId !== "string" ||
        typeof body?.event !== "string" ||
        !(KIOSK_STATUS_EVENTS as readonly string[]).includes(body.event)
      ) {
        return; // malformed/unknown event — drop.
      }
      const store = getJobs();
      void store.get(body.printJobId).then((job) => {
        if (!job || job.kioskId !== kioskId) return; // unknown job or wrong kiosk — drop.
        const message = typeof body.message === "string" ? body.message : undefined;
        void store.updateStatus(job.printJobId, body.event as PrintJobStatus, message).then((updated) => {
          if (!updated) return;
          io.to(jobRoom(job.printJobId)).emit(SOCKET_EVENTS.JOB_STATUS, {
            printJobId: job.printJobId,
            kioskId,
            event: body.event,
            message,
            at: updated.updatedAt,
          });
        });
      });
    });

    socket.on("disconnect", () => unregisterKiosk(kioskId, socket));
  });
}
