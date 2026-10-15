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
import { completeActive, markSent, positionOf, waiting } from "./jobs/queue.js";

const AUTO_ENROLL = process.env.AUTO_ENROLL_KIOSKS === "true";

interface KioskAuth {
  role?: string;
  kioskId?: string;
  token?: string;
}

interface UserAuth {
  role?: string;
  printJobId?: string;
  token?: string;
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

const TERMINAL = new Set(["PRINT_SUCCESS", "ERROR", "PRINTER_ERROR"]);

/** Hand a QUEUED job to its kiosk: dequeue, mark active, emit + announce. */
export async function dispatchToKiosk(
  io: Server,
  job: { printJobId: string; kioskId: string; fileUrl: string; copies: number; color: string; duplex: boolean },
): Promise<void> {
  markSent(job.kioskId, job.printJobId);
  io.to(kioskRoom(job.kioskId)).emit(SOCKET_EVENTS.NEW_PRINT_JOB, job);
  const updated = await getJobs().updateStatus(job.printJobId, "SENT_TO_KIOSK");
  if (updated) {
    io.to(jobRoom(job.printJobId)).emit(SOCKET_EVENTS.JOB_STATUS, {
      printJobId: job.printJobId,
      kioskId: job.kioskId,
      event: "SENT_TO_KIOSK",
      position: 0,
      at: updated.updatedAt,
    });
  }
}

export async function emitNewPrintJob(
  io: Server,
  job: { printJobId: string; kioskId: string; fileUrl: string; copies: number; color: string; duplex: boolean },
): Promise<void> {
  return dispatchToKiosk(io, job);
}

/** Broadcast fresh queue positions to every waiting job room. */
async function announcePositions(io: Server, kioskId: string): Promise<void> {
  for (const id of waiting(kioskId)) {
    const job = await getJobs().get(id);
    if (!job) continue;
    io.to(jobRoom(id)).emit(SOCKET_EVENTS.JOB_STATUS, {
      printJobId: id,
      kioskId,
      event: job.status,
      position: positionOf(kioskId, id),
      at: job.updatedAt,
    });
  }
}

export function setupSocket(io: Server): void {
  io.use(async (socket, next) => {
    const auth = socket.handshake.auth as KioskAuth & UserAuth;
    if (auth.role === "user") {
      if (!auth.printJobId) return next(new Error("Missing printJobId"));
      // v1 gap closed (issue #13): job accessToken required, verified hashed.
      if (!auth.token) return next(new Error("Missing job access token"));
      const job = await getJobs().verifyAccess(auth.printJobId, auth.token);
      if (!job) return next(new Error("Invalid job access token"));
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
              position: job ? positionOf(job.kioskId, printJobId) : 0,
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
      const event = body.event as string;
      void store.get(body.printJobId).then((job) => {
        if (!job || job.kioskId !== kioskId) return; // unknown job or wrong kiosk — drop.
        const message = typeof body.message === "string" ? body.message : undefined;
        void store.updateStatus(job.printJobId, event as PrintJobStatus, message).then((updated) => {
          if (!updated) return;
          io.to(jobRoom(job.printJobId)).emit(SOCKET_EVENTS.JOB_STATUS, {
            printJobId: job.printJobId,
            kioskId,
            event,
            message,
            position: 0,
            at: updated.updatedAt,
          });
          if (TERMINAL.has(event)) {
            // Hand the next queued job to this kiosk (FIFO, issue #12).
            const nextId = completeActive(kioskId, job.printJobId);
            void (async () => {
              if (nextId) {
                const next = await store.get(nextId);
                if (next) await dispatchToKiosk(io, next);
              }
              await announcePositions(io, kioskId);
            })();
          }
        });
      });
    });

    socket.on("disconnect", () => unregisterKiosk(kioskId, socket));
  });
}
