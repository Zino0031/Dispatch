"use client";

import { useEffect, useState } from "react";
import { backendUrl } from "../backend";

type Kiosk = { kioskId: string; displayName: string; online: boolean; connectedAt?: string };
type JobError = { code: string; message: string; status: string; at: string };
type JobHistory = { status: string; message?: string; errorCode?: string; at: string };
type Job = { printJobId: string; kioskId: string; status: string; copies: number; color: string; duplex: boolean; createdAt: string; updatedAt: string; lastError?: JobError; history: JobHistory[] };
type Overview = { kiosks: Kiosk[]; jobs: Job[]; summary: { kiosksOnline: number; jobsTotal: number; jobsActive: number } };

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  async function loadOverview(adminToken = token) {
    setError("");
    const url = backendUrl();
    const response = await fetch(`${url}/api/admin/overview`, {
      headers: { "x-admin-token": adminToken },
    });
    if (!response.ok) {
      setAuthenticated(false);
      setError("Invalid admin token or backend unavailable.");
      return;
    }
    setOverview(await response.json() as Overview);
    setAuthenticated(true);
    sessionStorage.setItem("print-kiosk-admin-token", adminToken);
  }

  async function renameKiosk(kiosk: Kiosk) {
    const displayName = window.prompt("Kiosk display name", kiosk.displayName)?.trim();
    if (!displayName || displayName === kiosk.displayName) return;

    const response = await fetch(`${backendUrl()}/api/admin/kiosks/${encodeURIComponent(kiosk.kioskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ displayName }),
    });
    if (!response.ok) {
      setError("The kiosk name could not be changed.");
      return;
    }
    await loadOverview();
  }

  useEffect(() => {
    const savedToken = sessionStorage.getItem("print-kiosk-admin-token");
    if (savedToken) {
      setToken(savedToken);
      void loadOverview(savedToken);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const refreshTimer = window.setInterval(() => void loadOverview(), 5000);
    return () => window.clearInterval(refreshTimer);
  }, [authenticated]);

  if (!authenticated) {
    return (
      <main className="admin-shell admin-login">
        <div className="admin-brand"><span>PK</span><strong>Campus print / operations</strong></div>
        <section className="admin-login-panel">
          <p className="eyebrow">RESTRICTED AREA</p>
          <h1>Operations console</h1>
          <p>Sign in to monitor kiosks and print activity.</p>
          <form onSubmit={(event) => { event.preventDefault(); void loadOverview(); }}>
            <label>Admin token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoFocus /></label>
            <button className="admin-button" type="submit">Open dashboard</button>
          </form>
          {error && <p className="admin-error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar"><div className="admin-brand"><span>PK</span><strong>Campus print / operations</strong></div><button className="admin-signout" onClick={() => { sessionStorage.removeItem("print-kiosk-admin-token"); setAuthenticated(false); setOverview(null); }}>Sign out</button></header>
      <div className="admin-heading"><div><p className="eyebrow">LIVE CONTROL ROOM</p><h1>Kiosk overview</h1></div><button className="refresh-button" onClick={() => void loadOverview()}>Refresh ↻</button></div>
      <section className="metrics"><div><span>ONLINE KIOSKS</span><strong>{overview?.summary.kiosksOnline ?? 0}<small> / {overview?.kiosks.length ?? 0}</small></strong></div><div><span>ACTIVE JOBS</span><strong>{overview?.summary.jobsActive ?? 0}</strong></div><div><span>TOTAL JOBS</span><strong>{overview?.summary.jobsTotal ?? 0}</strong></div></section>
      <section className="admin-grid">
        <div className="admin-card"><div className="card-title"><h2>Kiosk fleet</h2><span>{overview?.kiosks.length ?? 0} registered</span></div><div className="kiosk-list">{overview?.kiosks.map((kiosk) => <div className="kiosk-row" key={kiosk.kioskId}><span className={`fleet-dot ${kiosk.online ? "online" : "offline"}`} /><div><strong>{kiosk.displayName}</strong><small>{kiosk.kioskId} · Uses local CUPS default printer · {kiosk.online ? `Connected ${kiosk.connectedAt ? new Date(kiosk.connectedAt).toLocaleTimeString() : "now"}` : "Offline"}</small></div><button className="rename-button" type="button" onClick={() => void renameKiosk(kiosk)}>Rename</button><span className={`fleet-status ${kiosk.online ? "online-text" : "offline-text"}`}>{kiosk.online ? "ONLINE" : "OFFLINE"}</span></div>)}</div></div>
        <div className="admin-card"><div className="card-title"><h2>Recent print jobs</h2><span>{overview?.jobs.length ?? 0} shown · refreshes every 5s</span></div><div className="job-list">{overview?.jobs.length ? overview.jobs.map((job) => <details className={`job-row ${job.lastError ? "job-failed" : ""}`} key={job.printJobId}><summary><div><strong>{job.printJobId.slice(0, 8)}...</strong><small>{job.kioskId} · {job.copies} {job.copies === 1 ? "copy" : "copies"} · {new Date(job.createdAt).toLocaleString()}</small></div><span className="job-status">{job.status.replaceAll("_", " ")}</span></summary><div className="job-diagnostics">{job.lastError ? <div className="error-box"><span className="error-code">{job.lastError.code}</span><strong>{job.lastError.message}</strong><small>{job.lastError.status.replaceAll("_", " ")} · {new Date(job.lastError.at).toLocaleString()}</small></div> : <p className="healthy-message">No error recorded for this job.</p>}<div className="history-list"><strong>Event history</strong>{job.history.map((event, index) => <div className="history-event" key={`${event.at}-${index}`}><span>{new Date(event.at).toLocaleTimeString()}</span><b>{event.status.replaceAll("_", " ")}</b><small>{event.message ?? "No additional message"}</small></div>)}</div></div></details>) : <p className="empty-state">No jobs have been submitted yet.</p>}</div></div>
      </section>
    </main>
  );
}