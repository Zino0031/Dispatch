/** Simulated kiosk for local dev (docs/SOCKET_PROTOCOL.md). */
import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:4000";
const KIOSK_ID = process.env.KIOSK_ID ?? "kiosk-lab-1";
const KIOSK_TOKEN = process.env.KIOSK_TOKEN ?? "";

const socket = io(SERVER_URL, {
  auth: { role: "kiosk", kioskId: KIOSK_ID, token: KIOSK_TOKEN },
  transports: ["websocket"],
});

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

socket.on("connect", () => {
  // eslint-disable-next-line no-console
  console.log(`fake-kiosk connected as ${KIOSK_ID}`);
});

socket.on("connect_error", (err: Error) => {
  // eslint-disable-next-line no-console
  console.log(`fake-kiosk connect_error: ${err.message}`);
  process.exitCode = 1;
});

socket.on("KIOSK_ENROLLED", (msg: unknown) => {
  // eslint-disable-next-line no-console
  console.log("fake-kiosk enrolled:", JSON.stringify(msg));
});

socket.on(
  "NEW_PRINT_JOB",
  async (job: { printJobId: string; kioskId: string; fileUrl: string; copies: number }) => {
    // eslint-disable-next-line no-console
    console.log(`fake-kiosk received job ${job.printJobId} (${job.copies} copies)`);
    const send = (event: string): void => {
      socket.emit("kiosk_status", { printJobId: job.printJobId, event });
    };
    send("DOWNLOAD_START");
    await wait(300);
    send("DOWNLOAD_COMPLETE");
    await wait(300);
    send("PRINTING_STARTED");
    await wait(500);
    send("PRINT_SUCCESS");
    // eslint-disable-next-line no-console
    console.log(`fake-kiosk completed job ${job.printJobId}`);
  },
);
