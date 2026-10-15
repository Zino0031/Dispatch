import { Router } from "express";
import { z } from "zod";
import { log } from "../logger.js";
import {
  confirmTestPayment,
  getIntent,
  quotePrice,
  voidIntent,
} from "./pricing.js";

const quoteSchema = z.object({
  copies: z.number().int().min(1).max(50),
  pages: z.number().int().min(1).max(1000).optional(),
  color: z.enum(["bw", "color"]),
  duplex: z.boolean(),
});

export function createPaymentsRouter(): Router {
  const router = Router();

  // Server-side quote — never trust a client total (issue #17).
  router.post("/quote", (req, res) => {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid quote payload" });
    return res.json(quotePrice(parsed.data));
  });

  // Test checkout (1.2 s fake processor). Labelled "Test" in the web UI.
  router.post("/pay", async (req, res) => {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid pay payload" });
    const quote = quotePrice(parsed.data);
    const intent = await confirmTestPayment(quote.total);
    log.info("test payment confirmed", { paymentIntentId: intent.paymentIntentId, total: quote.total });
    return res.status(201).json({ paymentIntentId: intent.paymentIntentId, total: quote.total, status: intent.status });
  });

  router.get("/pay/:paymentIntentId", (req, res) => {
    const intent = getIntent(req.params.paymentIntentId);
    if (!intent) return res.status(404).json({ error: "Payment not found" });
    return res.json(intent);
  });

  router.post("/pay/:paymentIntentId/void", (req, res) => {
    if (!voidIntent(req.params.paymentIntentId)) {
      return res.status(404).json({ error: "Payment not found or already voided" });
    }
    log.info("test payment voided", { paymentIntentId: req.params.paymentIntentId });
    return res.json({ paymentIntentId: req.params.paymentIntentId, status: "voided" });
  });

  return router;
}
