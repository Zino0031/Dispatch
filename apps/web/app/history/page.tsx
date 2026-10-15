"use client";

import { useState } from "react";
import { backendUrl } from "../backend";

interface HistoryJob {
  printJobId: string;
  kioskId: string;
  copies: number;
  color: string;
  duplex: boolean;
  status: string;
  createdAt: string;
}

/** Per-user print history by guest code (issue #18). */
export default function History() {
  const [code, setCode] = useState("");
  const [jobs, setJobs] = useState<HistoryJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setJobs(null);
    try {
      const res = await fetch(`${backendUrl()}/api/users/me/history`, {
        headers: { "x-user-id": code.trim() },
      });
      if (res.status === 401) throw new Error("Enter your guest code first.");
      if (!res.ok) throw new Error(`history failed (${res.status})`);
      const data = (await res.json()) as { jobs: HistoryJob[] };
      setJobs(data.jobs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load history.");
    }
  };

  return (
    <main className="kiosk-main">
      <p className="kiosk-eyebrow">Campus print</p>
      <h1 className="kiosk-h1">Print history</h1>
      <label className="field">
        Guest code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Guest code"
        />
      </label>
      <button className="btn-secondary" onClick={load} style={{ marginTop: 8 }}>
        Show my prints
      </button>
      {error && <p className="pill pill-error">{error}</p>}
      {jobs && jobs.length === 0 && <p>No prints on this code yet.</p>}
      {jobs && jobs.length > 0 && (
        <ul className="timeline" style={{ marginTop: 12 }}>
          {jobs.map((j) => (
            <li key={j.printJobId}>
              <span className="mono">{new Date(j.createdAt).toLocaleString()}</span> · {j.kioskId} · {j.copies}×{j.color} ·{" "}
              <span className="pill">{j.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
