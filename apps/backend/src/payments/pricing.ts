import { randomUUID } from "node:crypto";

// Per-page test pricing (docs/PRD.md §6 successor): copies × pages × rate.
// Page counts come from the client estimate for now (server-clamped); exact
// page counting at upload is required before any real gateway (see
// docs/PILOT.md follow-ups / issue #17). Duplex does not change price in v1.
export const RATE_PER_PAGE = { bw: 5, color: 20 } as const;

export interface Quote {
  copies: number;
  pages: number;
  color: "bw" | "color";
  duplex: boolean;
  unit: number;
  total: number;
}

export function quotePrice(input: {
  copies: number;
  color: "bw" | "color";
  duplex: boolean;
  pages?: number;
}): Quote {
  const copies = Math.min(50, Math.max(1, Math.floor(input.copies)));
  const pages = Math.max(1, Math.floor(input.pages ?? 1));
  const unit = RATE_PER_PAGE[input.color];
  return { copies, pages, color: input.color, duplex: input.duplex, unit, total: copies * pages * unit };
}

export type IntentStatus = "confirmed" | "voided";

export interface PaymentIntent {
  paymentIntentId: string;
  total: number;
  status: IntentStatus;
  jobId: string | null;
  createdAt: string;
}

const intents = new Map<string, PaymentIntent>();

/** Test provider: confirms after ~1.2 s. NOT a real charge (issue #17). */
export async function confirmTestPayment(total: number): Promise<PaymentIntent> {
  await new Promise((r) => setTimeout(r, 1200));
  const intent: PaymentIntent = {
    paymentIntentId: randomUUID(),
    total,
    status: "confirmed",
    jobId: null,
    createdAt: new Date().toISOString(),
  };
  intents.set(intent.paymentIntentId, intent);
  return intent;
}

export function getIntent(id: string): PaymentIntent | undefined {
  return intents.get(id);
}

export function attachJob(paymentIntentId: string, printJobId: string): void {
  const intent = intents.get(paymentIntentId);
  if (intent) intent.jobId = printJobId;
}

/** Void (refund the test charge). Returns false when unknown/already voided. */
export function voidIntent(paymentIntentId: string): boolean {
  const intent = intents.get(paymentIntentId);
  if (!intent || intent.status === "voided") return false;
  intent.status = "voided";
  return true;
}
