"use client";

import { useCallback, useEffect, useState } from "react";
import { backendUrl } from "../backend";

interface KioskRow {
  kioskId: string;
  displayName: string;
  online: boolean;
  connectedAt?: string;
}

interface JobRow {
  printJobId: string;
  kioskId: string;
  copies: number;
  color: string;
  duplex: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Overview {
  kiosks: KioskRow[];
  jobs: JobRow[];
  metrics: {
    successRate: number | null;
    errorBreakdown: Record<string, number>;
    medianUploadToSuccessMs: number | null;
    perKiosk: { kioskId: string; online: boolean; total: number; success: number; rate: number | null }[];
  } | null;
  summary: { kiosksOnline: number; jobsTotal: number; jobsActive: number };
}

/**
 * Operations console (issue #3).
 * Token comes from user input (localStorage) — never hardcoded.
 * 401 renders as "check admin token", never a stack trace.
 */
export default function Admin() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [enrollId, setEnrollId] = useState("");
  const [enrollName, setEnrollName] = useState("");
  const [enrollToken, setEnrollToken] = useState("");
  const [oneTime, setOneTime] = useState<string | null>(null);

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("admin-token") ?? "");
    setReady(true);
  }, []);

  const headers = useCallback(
    (extra: Record<string, string> = {}) => ({
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...extra,
    }),
    [token],
  );

  const describeError = useCallback(async (res: Response): Promise<string> => {
    if (res.status === 401) return "Check admin token — it was rejected (401).";
    if (res.status === 404) return "Not found (404) — that kiosk isn't enrolled.";
    try {
      const data = (await res.json()) as { error?: string };
      return data.error ?? `Request failed (${res.status}).`;
    } catch {
      return `Request failed (${res.status}).`;
    }
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${backendUrl()}/api/admin/overview`, { headers: headers() });
      if (!res.ok) throw new Error(await describeError(res));
      setOverview((await res.json()) as Overview);
    } catch (e) {
      setOverview(null);
      setError(e instanceof Error ? e.message : "Couldn't load overview.");
    }
  }, [headers, describeError]);

  const saveToken = (v: string) => {
    setToken(v);
    localStorage.setItem("admin-token", v);
  };

  const downloadCsv = async () => {
    setError(null);
    try {
      const res = await fetch(`${backendUrl()}/api/admin/metrics.csv`, { headers: headers() });
      if (!res.ok) throw new Error(await describeError(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "metrics.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV download failed.");
    }
  };

  const enroll = async () => {
    setError(null);
    setOneTime(null);
    try {
      const res = await fetch(`${backendUrl()}/api/admin/kiosks/enroll`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ kioskId: enrollId, displayName: enrollName, enrollmentToken: enrollToken }),
      });
      if (!res.ok) throw new Error(await describeError(res));
      const data = (await res.json()) as { token: string };
      setOneTime(data.token);
      setEnrollId("");
      setEnrollName("");
      setEnrollToken("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enroll failed.");
    }
  };

  const rename = async (kioskId: string) => {
    setError(null);
    try {
      const res = await fetch(`${backendUrl()}/api/admin/kiosks/${encodeURIComponent(kioskId)}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ displayName: renameValue }),
      });
      if (!res.ok) throw new Error(await describeError(res));
      setRenaming(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    }
  };

  if (!ready) return <main className="kiosk-main">Loading…</main>;

  return (
    <main className="kiosk-main" style={{ maxWidth: 640 }}>
      <p className="kiosk-eyebrow">Campus print · ops</p>
      <h1 className="kiosk-h1">Admin console</h1>

      <label className="field">
        Admin token
        <input
          type="password"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          placeholder="x-admin-token"
        />
      </label>
      <button className="btn-secondary" onClick={refresh} style={{ marginTop: 8 }}>
        Load overview
      </button>

      {error && (
        <p aria-live="polite" className="pill pill-error">
          {error}
        </p>
      )}

      {overview && (
        <>
          <p>
            {overview.summary.kiosksOnline} online · {overview.summary.jobsTotal} jobs (
            {overview.summary.jobsActive} active)
          </p>
          {overview.metrics && (
            <section className="panel" style={{ marginBottom: 12 }}>
              <h2>Fleet metrics</h2>
              <p>
                Success rate:{" "}
                {overview.metrics.successRate === null ? "—" : `${overview.metrics.successRate}%`}
                {overview.metrics.medianUploadToSuccessMs !== null &&
                  ` · median upload→success ${(overview.metrics.medianUploadToSuccessMs / 1000).toFixed(1)}s`}
              </p>
              {Object.keys(overview.metrics.errorBreakdown).length > 0 && (
                <ul className="timeline" style={{ margin: "0 0 8px" }}>
                  {Object.entries(overview.metrics.errorBreakdown).map(([k, v]) => (
                    <li key={k}>
                      <small>
                        {k}: {v}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="timeline" style={{ margin: "0 0 8px" }}>
                {overview.metrics.perKiosk.map((k) => (
                  <li key={k.kioskId}>
                    {k.kioskId} <span className={k.online ? "pill pill-online" : "pill"}>{k.online ? "●" : "○"}</span> {k.success}/{k.total}
                    {k.rate !== null ? ` (${k.rate}%)` : ""}
                  </li>
                ))}
              </ul>
              <button className="btn-secondary" onClick={downloadCsv}>
                Download CSV
              </button>
            </section>
          )}
          <h2>Kiosks</h2>
          <ul className="timeline">
            {overview.kiosks.map((k) => (
              <li key={k.kioskId} style={{ marginBottom: 8 }}>
                <strong>{k.displayName}</strong> <span className="mono">({k.kioskId})</span>{" "}
                <span className={k.online ? "pill pill-online" : "pill"}>
                  {k.online ? "● online" : "○ offline"}
                </span>{" "}
                {renaming === k.kioskId ? (
                  <>
                    <input
                      className="num-inline"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      maxLength={80}
                      style={{ marginLeft: 8, width: 160 }}
                    />
                    <button className="btn-ghost" onClick={() => rename(k.kioskId)} style={{ marginLeft: 4 }}>
                      Save
                    </button>
                    <button className="btn-ghost" onClick={() => setRenaming(null)} style={{ marginLeft: 4 }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setRenaming(k.kioskId);
                      setRenameValue(k.displayName);
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    Rename
                  </button>
                )}
              </li>
            ))}
          </ul>

          <h2>Recent jobs</h2>
          {overview.jobs.length === 0 ? (
            <p>No jobs yet.</p>
          ) : (
            <ul className="timeline">
              {overview.jobs.map((j) => (
                <li key={j.printJobId}>
                  <span className="mono">{j.printJobId.slice(0, 8)}</span> · {j.kioskId} · {j.copies}×{j.color} ·{" "}
                  <span className="pill">{j.status}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h2>Enroll a kiosk</h2>
      <label className="field">
        Kiosk ID
        <input
          value={enrollId}
          onChange={(e) => setEnrollId(e.target.value)}
          placeholder="kiosk-id"
        />
      </label>
      <label className="field">
        Display name (location)
        <input
          value={enrollName}
          onChange={(e) => setEnrollName(e.target.value)}
          placeholder="Display name (location)"
          maxLength={80}
        />
      </label>
      <label className="field">
        Enrollment token (operator secret)
        <input
          type="password"
          value={enrollToken}
          onChange={(e) => setEnrollToken(e.target.value)}
          placeholder="Enrollment token (operator secret)"
        />
      </label>
      <button className="btn-secondary" onClick={enroll} style={{ marginTop: 8 }}>
        Enroll
      </button>
      {oneTime && (
        <section className="panel">
          <p>
            One-time kiosk token (copy now — it won&apos;t be shown again):
          </p>
          <code className="mono" style={{ wordBreak: "break-all" }}>{oneTime}</code>
          <p style={{ marginTop: 8 }}>
            Save it on the Mini PC as <code>KIOSK_TOKEN</code> in <code>.env</code>.
          </p>
          <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(oneTime)} style={{ marginTop: 8 }}>
            Copy
          </button>
        </section>
      )}
    </main>
  );
}
