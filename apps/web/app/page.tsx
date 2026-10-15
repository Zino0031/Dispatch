"use client";

import { useCallback, useEffect, useState } from "react";
import { backendUrl } from "./backend";
import LiveTracking from "./tracking";
import { validateFile } from "../lib/validateFile";

interface Kiosk {
  kioskId: string;
  displayName: string;
  online: boolean;
  connectedAt?: string;
}

interface UploadedFile {
  fileUrl: string;
  fileToken: string;
  fileName: string;
  mimeType: string;
  size: number;
}

type Step = "kiosk" | "upload" | "sent";

/**
 * Wizard steps 1–2 + live tracking (issues #1, #2, #4).
 * Kiosk picker with empty-state + upload with client/server validation,
 * retry preserving the file, 503 offline dispatch messaging, and a
 * user-role socket timeline (tracking.tsx). Review/payment land later.
 */
export default function Home() {
  const [step, setStep] = useState<Step>("kiosk");
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [kiosksLoading, setKiosksLoading] = useState(true);
  const [kiosksError, setKiosksError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [kioskWentOffline, setKioskWentOffline] = useState(false);
  const [printJobId, setPrintJobId] = useState<string | null>(null);
  const [jobToken, setJobToken] = useState<string | null>(null);

  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [duplex, setDuplex] = useState(false);
  const [pages, setPages] = useState(1);
  const [quote, setQuote] = useState<{ copies: number; pages: number; color: string; duplex: boolean; unit: number; total: number } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [intent, setIntent] = useState<string | null>(null);
  const [intentTotal, setIntentTotal] = useState<number | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const [guestCode, setGuestCode] = useState("");
  const [quotaLine, setQuotaLine] = useState<string | null>(null);

  useEffect(() => {
    try {
      setGuestCode(localStorage.getItem("guest-code") ?? "");
    } catch {
      // Private mode — guest code just won't persist.
    }
  }, []);

  const saveGuestCode = (v: string) => {
    setGuestCode(v);
    try {
      localStorage.setItem("guest-code", v);
    } catch {
      // ignore
    }
  };

  const load = useCallback(async () => {
    setKiosksLoading(true);
    setKiosksError(null);
    try {
      const res = await fetch(`${backendUrl()}/api/kiosks`, { cache: "no-store" });
      if (!res.ok) throw new Error(`backend responded ${res.status}`);
      const data = (await res.json()) as { kiosks: Kiosk[] };
      const list = Array.isArray(data.kiosks) ? data.kiosks : [];
      setKiosks(list);
      setSelected((prev) => {
        if (prev && list.some((k) => k.kioskId === prev)) return prev;
        return list[0]?.kioskId ?? null;
      });
    } catch (e) {
      setKiosksError(e instanceof Error ? e.message : "failed to reach backend");
    } finally {
      setKiosksLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 10_000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const pickFile = (f: File | null) => {
    setSendError(null);
    setKioskWentOffline(false);
    if (!f) {
      setFile(null);
      setFileError(null);
      return;
    }
    const problem = validateFile(f);
    setFile(f);
    setFileError(problem);
    setUploaded(null);
    setQuote(null);
    setIntent(null);
    setPayError(null);
  };

  const upload = async () => {
    if (!file || uploading) return;
    const problem = validateFile(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    setUploading(true);
    setFileError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${backendUrl()}/api/upload`, { method: "POST", body: form });
      const data = (await res.json()) as UploadedFile & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `upload failed (${res.status})`);
      setUploaded(data);
    } catch (e) {
      // File stays selected so Retry reuses it.
      setFileError(e instanceof Error ? e.message : "Upload failed. Tap Retry to try again.");
    } finally {
      setUploading(false);
    }
  };

  const fetchQuota = useCallback(async () => {
    if (!guestCode.trim()) {
      setQuotaLine(null);
      return;
    }
    try {
      const res = await fetch(`${backendUrl()}/api/users/me/quota`, {
        headers: { "x-user-id": guestCode.trim() },
      });
      if (!res.ok) throw new Error("quota check failed");
      const q = (await res.json()) as { remainingPages: number; quotaPages: number };
      setQuotaLine(`${q.remainingPages} of ${q.quotaPages} pages left (30 days)`);
    } catch {
      setQuotaLine(null);
    }
  }, [guestCode]);

  useEffect(() => {
    if (uploaded) void fetchQuota();
  }, [uploaded, fetchQuota]);

  const fetchQuote = async () => {
    setQuoting(true);
    setPayError(null);
    try {
      const res = await fetch(`${backendUrl()}/api/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copies, color, duplex, pages }),
      });
      if (!res.ok) throw new Error(`quote failed (${res.status})`);
      setQuote(await res.json());
      setIntent(null);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Couldn't get a price.");
    } finally {
      setQuoting(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`${backendUrl()}/api/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copies, color, duplex, pages }),
      });
      const data = (await res.json()) as { paymentIntentId?: string; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `payment failed (${res.status})`);
      setIntent(data.paymentIntentId ?? null);
      setIntentTotal(data.total ?? null);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Test payment failed.");
    } finally {
      setPaying(false);
    }
  };

  const send = async () => {
    if (!uploaded || !selected || sending) return;
    setSending(true);
    setSendError(null);
    setKioskWentOffline(false);
    try {
      const res = await fetch(`${backendUrl()}/api/print-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(guestCode.trim() ? { "x-user-id": guestCode.trim() } : {}),
        },
        body: JSON.stringify({
          kioskId: selected,
          fileUrl: uploaded.fileUrl,
          copies,
          color,
          duplex,
          pagesEstimate: pages,
          paymentIntentId: intent ?? undefined,
        }),
      });
      const data = (await res.json()) as { printJobId?: string; accessToken?: string; error?: string };
      if (res.status === 503) {
        // Kiosk went offline between selection and dispatch — never hang.
        setKioskWentOffline(true);
        setSendError("That printer just went offline. Pick another kiosk or try again.");
        void load();
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `dispatch failed (${res.status})`);
      setPrintJobId(data.printJobId ?? null);
      setJobToken(data.accessToken ?? null);
      setStep("sent");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't send to printer. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="kiosk-main">
      <p className="kiosk-eyebrow">Campus print</p>
      <h1 className="kiosk-h1">
        Print <span className="kiosk-wordmark">Kiosk</span>
      </h1>
      <p style={{ marginTop: 0 }}>
        <label className="field">
          Guest code (optional — tracks quota + history)
          <input
            value={guestCode}
            onChange={(e) => saveGuestCode(e.target.value)}
            placeholder="e.g. library card code"
          />
        </label>
      </p>

      {step === "kiosk" && (
        <>
          <p className="kiosk-sub">Step 1 of 6 — pick a printer near you.</p>
          {kiosksLoading && kiosks.length === 0 && <p>Looking for printers…</p>}
          {kiosksError && (
            <section aria-live="polite" className="panel panel-error">
              <h2>Can&apos;t reach the print service</h2>
              <p>{kiosksError} — check your connection and try again.</p>
              <button className="btn-secondary" onClick={load}>Retry</button>
            </section>
          )}
          {!kiosksLoading && !kiosksError && kiosks.length === 0 && (
            <section aria-live="polite" className="panel">
              <h2>No printers online right now</h2>
              <p>
                All kiosks in this location are offline. Try again in a moment — the list refreshes
                automatically — or ask staff for the nearest working printer.
              </p>
              <button className="btn-secondary" onClick={load}>Retry now</button>
            </section>
          )}
          {kiosks.length > 0 && (
            <ul className="kiosk-list">
              {kiosks.map((k) => (
                <li key={k.kioskId}>
                  <button
                    className="kiosk-card"
                    onClick={() => setSelected(k.kioskId)}
                    aria-pressed={selected === k.kioskId}
                  >
                    <strong>{k.displayName || k.kioskId}</strong>
                    <br />
                    <span className="pill pill-online">● online</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="btn-primary"
            disabled={!selected}
            title={selected ? "Continue to upload" : "Select a printer to continue"}
            onClick={() => setStep("upload")}
          >
            {selected ? "Continue" : "Select a printer to continue"}
          </button>
        </>
      )}

      {step === "upload" && (
        <>
          <p className="kiosk-sub">Step 2 of 6 — upload your document.</p>
          <label className="field">
            Choose file (PDF, JPG, PNG, DOC, DOCX — max 50 MB)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-muted)" }}>
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          {fileError && (
            <section aria-live="polite" className="panel panel-error">
              <p>{fileError}</p>
              <button className="btn-secondary" onClick={upload} disabled={uploading}>
                {uploading ? "Uploading…" : "Retry upload"}
              </button>
            </section>
          )}
          {file && !fileError && !uploaded && (
            <button className="btn-primary" onClick={upload} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
          )}
          {uploaded && (
            <section className="panel">
              <p>Uploaded: {uploaded.fileName} ({(uploaded.size / 1024).toFixed(0)} KB</p>
            </section>
          )}
          {uploaded && (
            <>
              <fieldset className="panel" style={{ borderStyle: "solid" }}>
                <legend style={{ fontSize: 14, padding: "0 8px" }}>Print options</legend>
                <label className="check-row" style={{ marginTop: 0 }}>
                  Copies (1–50)
                  <input
                    className="num-inline"
                    type="number" min={1} max={50} value={copies}
                    onChange={(e) => setCopies(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </label>
                <div className="seg" role="group" aria-label="Color mode" style={{ marginBottom: 8 }}>
                  <button onClick={() => setColor("bw")} aria-pressed={color === "bw"}>B&W</button>
                  <button onClick={() => setColor("color")} aria-pressed={color === "color"}>Color</button>
                </div>
                <label className="check-row">
                  <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} /> Double-sided
                </label>
                <label className="check-row" style={{ marginBottom: 0 }}>
                  Pages (estimate)
                  <input
                    className="num-inline"
                    type="number" min={1} value={pages}
                    onChange={(e) => setPages(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
              </fieldset>
              <section className="panel">
                <h2>Test checkout — no real charge</h2>
                {quotaLine && <p>Quota: {quotaLine}</p>}
                {!quote && (
                  <button className="btn-secondary" onClick={fetchQuote} disabled={quoting}>
                    {quoting ? "Quoting…" : "Get price"}
                  </button>
                )}
                {quote && (
                  <>
                    <p>
                      {quote.copies}×{quote.pages} pages {quote.color}
                      {quote.duplex ? ", duplex" : ""} = {quote.total} credits ({quote.unit}/page)
                    </p>
                    {!intent && (
                      <button className="btn-secondary" onClick={pay} disabled={paying}>
                        {paying ? "Processing test payment…" : `Pay ${quote.total} (Test)`}
                      </button>
                    )}
                  </>
                )}
                {intent && (
                  <p>Receipt: paid {intentTotal} (Test) — intent <span className="mono">{intent.slice(0, 8)}</span>.</p>
                )}
                {payError && <p className="pill pill-error">{payError}</p>}
              </section>
              <button className="btn-primary" onClick={send} disabled={sending || !intent} title={intent ? "Send to printer" : "Pay (Test) first"}>
                {sending ? "Sending…" : "Send to printer"}
              </button>
              {sendError && (
                <section aria-live="polite" className="panel panel-error">
                  <p>{sendError}</p>
                  {kioskWentOffline ? (
                    <button className="btn-secondary" onClick={() => { setStep("kiosk"); void load(); }}>
                      Back to printers
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={send} disabled={sending}>
                      Try again
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          <button className="btn-ghost" onClick={() => setStep("kiosk")} style={{ marginTop: 12 }}>
            Back
          </button>
        </>
      )}

      {step === "sent" && printJobId && (
        <LiveTracking printJobId={printJobId} jobToken={jobToken} onRetry={() => { setStep("upload"); }} />
      )}
    </main>
  );
}
