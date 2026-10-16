import cors from "cors";
import express from "express";
import { join } from "node:path";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { config, isAllowedCorsOrigin } from "./config.js";
import { createPrintJobRouter } from "./routes/printJob.js";
import { createAdminRouter } from "./routes/admin.js";
import { attachSocketServer, onlineKioskCount } from "./socket.js";
import { hydrateKioskSettings } from "./kioskRegistry.js";
import { checkSupabaseConnection } from "./supabase.js";

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin)),
    methods: ["GET", "POST"],
  },
});

attachSocketServer(io);
void hydrateKioskSettings();

app.use(cors({ origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin)) }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    onlineKiosks: onlineKioskCount(),
  });
});

app.get("/health/supabase", async (_req, res) => {
  res.json(await checkSupabaseConnection());
});

app.use("/api", createPrintJobRouter(io));
app.use("/api/admin", createAdminRouter());

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  },
);

httpServer.listen(config.port, () => {
  console.log(`Print kiosk backend listening on http://localhost:${config.port}`);
});
