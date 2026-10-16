import { io as connect } from "socket.io-client";

const serverUrl = process.env.SERVER_URL ?? "http://localhost:4000";
const kioskId = process.env.KIOSK_ID ?? "kiosk-lab-1";
const token = process.env.KIOSK_TOKEN ?? "kiosk-lab-1-secret";

const socket = connect(serverUrl, {
  auth: { role: "kiosk", kioskId, token },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log(`Fake kiosk "${kioskId}" connected (${socket.id})`);
});

socket.on("connect_error", (error) => {
  console.error("Connection failed:", error.message);
});

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

socket.on("NEW_PRINT_JOB", (payload) => {
  console.log("NEW_PRINT_JOB", JSON.stringify(payload, null, 2));
  void (async () => {
    const printJobId = (payload as { printJobId?: unknown }).printJobId;
    if (typeof printJobId !== "string") return;
    for (const event of ["DOWNLOAD_START", "DOWNLOAD_COMPLETE", "PRINTING_STARTED"] as const) {
      socket.emit("kiosk_status", { printJobId, event });
      await wait(300);
    }
    socket.emit("kiosk_status", { printJobId, event: "PRINT_SUCCESS" });
    console.log(`Completed ${printJobId}`);
  })();
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});
