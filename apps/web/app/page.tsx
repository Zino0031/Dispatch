"use client";

import { useCallback, useEffect, useState } from "react";
import { backendUrl } from "./backend";
import { validateFile } from "../lib/validateFile";

interface Kiosk {
  kioskId: string;
  displayName: string;
  online: boolean;
  connectedAt?: string;
}

interface UploadedFile {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
}

type Step = "kiosk" | "upload" | "sent";

/**
 * Wizard steps 1–2 (issues #1–#2).
 * Kiosk picker with empty-state + upload with client/server validation,
 * retry preserving the file, and 503 offline dispatch messaging.
 * Review/payment/tracking land in issues #3–#4.
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

  const send = async () => {
    if (!uploaded || !selected || sending) return;
    setSending(true);
    setSendError(null);
    setKioskWentOffline(false);
    try {
      const res = await fetch(`${backendUrl()}/api/print-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kioskId: selected,
          fileUrl: uploaded.fileUrl,
          copies: 1,
          color: "bw",
          duplex: false,
        }),
      });
      const data = (await res.json()) as { printJobId?: string; error?: string };
      if (res.status === 503) {
        // Kiosk went offline between selection and dispatch — never hang.
        setKioskWentOffline(true);
        setSendError("That printer just went offline. Pick another kiosk or try again.");
        void load();
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `dispatch failed (${res.status})`);
      setPrintJobId(data.printJobId ?? null);
      setStep("sent");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't send to printer. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Print Kiosk</h1>

      {step === "kiosk" && (
        <>
          <p style={{ color: "#555", marginTop: 0 }}>Step 1 of 6 — pick a printer near you.</p>
          {kiosksLoading && kiosks.length === 0 && <p>Looking for printers…</p>}
          {kiosksError && (
            <section aria-live="polite" style={{ border: "1px solid #d33", borderRadius: 8, padding: 16, marginTop: 12 }}>
              <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Can&apos;t reach the print service</h2>
              <p style={{ margin: "0 0 12px" }}>{kiosksError} — check your connection and try again.</p>
              <button onClick={load} style={{ padding: "8px 16px" }}>Retry</button>
            </section>
          )}
          {!kiosksLoading && !kiosksError && kiosks.length === 0 && (
            <section aria-live="polite" style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginTop: 12 }}>
              <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>No printers online right now</h2>
              <p style={{ margin: "0 0 12px" }}>
                All kiosks in this location are offline. Try again in a moment — the list refreshes
                automatically — or ask staff for the nearest working printer.
              </p>
              <button onClick={load} style={{ padding: "8px 16px" }}>Retry now</button>
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
                      width: "100%", textAlign: "left", padding: 12, borderRadius: 8,
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
            onClick={() => setStep("upload")}
          >
            {selected ? "Continue" : "Select a printer to continue"}
          </button>
        </>
      )}

      {step === "upload" && (
        <>
          <p style={{ color: "#555", marginTop: 0 }}>Step 2 of 6 — upload your document.</p>
          <label style={{ display: "block", marginTop: 12 }}>
            Choose file (PDF, JPG, PNG, DOC, DOCX — max 50 MB)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              style={{ display: "block", marginTop: 8 }}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <p style={{ margin: "8px 0 0" }}>
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          {fileError && (
            <section aria-live="polite" style={{ border: "1px solid #d33", borderRadius: 8, padding: 12, marginTop: 12 }}>
              <p style={{ margin: "0 0 8px" }}>{fileError}</p>
              <button onClick={upload} disabled={uploading} style={{ padding: "8px 16px" }}>
                {uploading ? "Uploading…" : "Retry upload"}
              </button>
            </section>
          )}
          {file && !fileError && !uploaded && (
            <button onClick={upload} disabled={uploading} style={{ marginTop: 12, padding: "10px 20px", width: "100%" }}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
          )}
          {uploaded && (
            <section style={{ border: "1px solid #2a2", borderRadius: 8, padding: 12, marginTop: 12 }}>
              <p style={{ margin: 0 }}>Uploaded: {uploaded.fileName} ({(uploaded.size / 1024).toFixed(0)} KB)</p>
            </section>
          )}
          {uploaded && (
            <>
              <button onClick={send} disabled={sending} style={{ marginTop: 12, padding: "10px 20px", width: "100%" }}>
                {sending ? "Sending…" : "Send to printer"}
              </button>
              {sendError && (
                <section aria-live="polite" style={{ border: "1px solid #d33", borderRadius: 8, padding: 12, marginTop: 12 }}>
                  <p style={{ margin: "0 0 8px" }}>{sendError}</p>
                  {kioskWentOffline ? (
                    <button onClick={() => { setStep("kiosk"); void load(); }} style={{ padding: "8px 16px" }}>
                      Back to printers
                    </button>
                  ) : (
                    <button onClick={send} disabled={sending} style={{ padding: "8px 16px" }}>
                      Try again
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          <button onClick={() => setStep("kiosk")} style={{ marginTop: 12, padding: "8px 16px" }}>
            Back
          </button>
        </>
      )}

      {step === "sent" && (
        <section aria-live="polite" style={{ border: "1px solid #2a2", borderRadius: 8, padding: 16, marginTop: 12 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Sent to printer</h2>
          <p style={{ margin: 0 }}>Job {printJobId} is on its way. Live tracking arrives in the next issue.</p>
        </section>
      )}
    </main>
  );
}
