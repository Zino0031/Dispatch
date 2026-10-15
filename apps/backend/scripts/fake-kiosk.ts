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

socket.on("NEW_PRINT_JOB", (payload) => {
  console.log("NEW_PRINT_JOB", JSON.stringify(payload, null, 2));
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});
