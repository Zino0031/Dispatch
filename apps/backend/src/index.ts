import cors from "cors";
import express from "express";
import { config, isAllowedCorsOrigin } from "./config.js";
import { onlineKiosks } from "./kioskRegistry.js";

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

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  app.listen(config.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`backend listening on :${config.PORT}`);
  });
}
