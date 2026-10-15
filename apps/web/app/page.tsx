"use client";

import { useCallback, useEffect, useState } from "react";
import { backendUrl } from "./backend";

interface Kiosk {
  kioskId: string;
  displayName: string;
  online: boolean;
  connectedAt?: string;
}

type LoadState = "loading" | "ready" | "error";

/**
 * Step: pick a kiosk (issue #1).
 * Empty-state card when none online, retry + auto-refresh so recovery is
 * visible without reload. Continue stays blocked until a kiosk is selected
 * (docs/PRD.md §5.2). Upload/review/payment/tracking land in issues #2–#4.
 */
export default function Home() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`${backendUrl()}/api/kiosks`, { cache: "no-store" });
      if (!res.ok) throw new Error(`backend responded ${res.status}`);
      const data = (await res.json()) as { kiosks: Kiosk[] };
      const list = Array.isArray(data.kiosks) ? data.kiosks : [];
      setKiosks(list);
      // Auto-select first online kiosk (docs/PRD.md §5.2); keep prior choice if still online.
      setSelected((prev) => {
        if (prev && list.some((k) => k.kioskId === prev)) return prev;
        return list[0]?.kioskId ?? null;
      });
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to reach backend");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    // Recovery without reload: poll + refetch on focus.
    const timer = setInterval(load, 10_000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Print Kiosk</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Step 1 of 6 — pick a printer near you.</p>

      {state === "loading" && kiosks.length === 0 && <p>Looking for printers…</p>}

      {state === "error" && (
        <section
          aria-live="polite"
          style={{ border: "1px solid #d33", borderRadius: 8, padding: 16, marginTop: 12 }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Can&apos;t reach the print service</h2>
          <p style={{ margin: "0 0 12px" }}>{error} — check your connection and try again.</p>
          <button onClick={load} style={{ padding: "8px 16px" }}>
            Retry
          </button>
        </section>
      )}

      {state === "ready" && kiosks.length === 0 && (
        <section
          aria-live="polite"
          style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginTop: 12 }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>No printers online right now</h2>
          <p style={{ margin: "0 0 12px" }}>
            All kiosks in this location are offline. Try again in a moment — the list refreshes
            automatically — or ask staff for the nearest working printer.
          </p>
          <button onClick={load} style={{ padding: "8px 16px" }}>
            Retry now
          </button>
        </section>
      )}

      {kiosks.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
          {kiosks.map((k) => (
            <li key={k.kioskId}>
              <button
                onClick={() => setSelected(k.kioskId)}
                aria-pressed={selected === k.kioskId}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 8,
                  border: selected === k.kioskId ? "2px solid #111" : "1px solid #ccc",
                  background: selected === k.kioskId ? "#f5f5f5" : "#fff",
                }}
              >
                <strong>{k.displayName || k.kioskId}</strong>
                <br />
                <small style={{ color: "green" }}>● online</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        disabled={!selected}
        title={selected ? "Continue to upload" : "Select a printer to continue"}
        style={{ marginTop: 16, padding: "10px 20px", width: "100%" }}
        onClick={() => {
          // Upload step lands in issue #2; selection persists via state for now.
          alert(`Printer selected: ${selected} — upload arrives in the next issue.`);
        }}
      >
        {selected ? "Continue" : "Select a printer to continue"}
      </button>
    </main>
  );
}
