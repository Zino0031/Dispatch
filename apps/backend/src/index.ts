import cors from "cors";
import express from "express";
import { config, isAllowedCorsOrigin } from "./config.js";
import { enrollKiosk, onlineKiosks, setKioskOnline } from "./kioskRegistry.js";
import { createAdminRouter } from "./routes/admin.js";
import { createPrintJobRouter } from "./routes/printJob.js";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || isAllowedCorsOrigin(origin)) return cb(null, true);
        return cb(new Error("CORS origin not allowed"));
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, onlineKiosks: onlineKiosks().length });
  });

  // Public kiosk list — online only (admin overview shows all; issue #3).
  app.get("/api/kiosks", (_req, res) => {
    res.json({ kiosks: onlineKiosks() });
  });

  app.use("/api", createPrintJobRouter());
  app.use("/api", createAdminRouter());
  // Statically served uploads — known gap, token-gated proxy lands in #10.
  app.use("/uploads", express.static("uploads"));

  return app;
}

// Dev/test seed: enroll + mark one kiosk online so dispatch 201 is exercisable
// before socket enrollment lands (issue #4). Never set in production.
if (process.env.TEST_SEED_KIOSK && process.env.NODE_ENV !== "production") {
  enrollKiosk(process.env.TEST_SEED_KIOSK, "Test kiosk", "unconfigured");
  setKioskOnline(process.env.TEST_SEED_KIOSK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  app.listen(config.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`backend listening on :${config.PORT}`);
  });
}
