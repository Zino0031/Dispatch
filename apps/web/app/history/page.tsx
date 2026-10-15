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
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24 }}>Print history</h1>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Guest code"
        style={{ display: "block", marginTop: 8, width: "100%", padding: 8 }}
      />
      <button onClick={load} style={{ marginTop: 8, padding: "8px 16px" }}>
        Show my prints
      </button>
      {error && <p style={{ color: "#b00" }}>{error}</p>}
      {jobs && jobs.length === 0 && <p>No prints on this code yet.</p>}
      {jobs && jobs.length > 0 && (
        <ul style={{ paddingLeft: 18 }}>
          {jobs.map((j) => (
            <li key={j.printJobId}>
              <small>
                {new Date(j.createdAt).toLocaleString()} · {j.kioskId} · {j.copies}×{j.color} · {j.status}
              </small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
