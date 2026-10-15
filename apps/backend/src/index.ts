import { createServer, type Server as HttpServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { config, isAllowedCorsOrigin } from "./config.js";
import { enrollKiosk, onlineKiosks, setKioskOnline } from "./kioskRegistry.js";
import { createAdminRouter } from "./routes/admin.js";
import { createFilesRouter } from "./routes/files.js";
import { createPaymentsRouter } from "./payments/router.js";
import { createPrintJobRouter } from "./routes/printJob.js";
import { log } from "./logger.js";
import { startRetentionSweeper } from "./retention.js";
import { setupSocket } from "./socket.js";
import { startWatchdog } from "./watchdog.js";

export function createApp(): { app: express.Express; server: HttpServer; io: Server } {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || isAllowedCorsOrigin(origin)) return cb(null, true);
      return cb(new Error("CORS origin not allowed"));
    },
  };
  app.use(cors(corsOptions));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, onlineKiosks: onlineKiosks().length });
  });

  // Public kiosk list — online only (admin overview shows all; issue #3).
  app.get("/api/kiosks", (_req, res) => {
    res.json({ kiosks: onlineKiosks() });
  });

  // One Node process owns both REST and Socket.io (docs/ARCHITECTURE.md §7).
  const server = createServer(app);
  const io = new Server(server, { cors: corsOptions });
  setupSocket(io);
  app.use("/api", createPrintJobRouter(io));
  app.use("/api", createAdminRouter());
  app.use("/api", createFilesRouter());
  app.use("/api", createPaymentsRouter());
  // uploads/ is NEVER statically served (issue #10) — all access goes
  // through the token-gated GET /api/files/:name proxy above.

  return { app, server, io };
}

// Dev/test seed: enroll + mark one kiosk online so dispatch 201 is exercisable
// without a socket kiosk. Never set in production.
if (process.env.TEST_SEED_KIOSK && process.env.NODE_ENV !== "production") {
  enrollKiosk(process.env.TEST_SEED_KIOSK, "Test kiosk", "unconfigured");
  setKioskOnline(process.env.TEST_SEED_KIOSK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startRetentionSweeper();
  const { server, io } = createApp();
  startWatchdog(io);
  server.listen(config.PORT, () => {
    log.info("backend listening", { port: config.PORT });
  });
}
