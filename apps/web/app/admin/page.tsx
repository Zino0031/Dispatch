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

  if (!ready) return <main style={{ padding: 20 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24 }}>Admin console</h1>

      <label style={{ display: "block", marginTop: 12 }}>
        Admin token
        <input
          type="password"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          placeholder="x-admin-token"
          style={{ display: "block", marginTop: 4, width: "100%", padding: 8 }}
        />
      </label>
      <button onClick={refresh} style={{ marginTop: 8, padding: "8px 16px" }}>
        Load overview
      </button>

      {error && (
        <p aria-live="polite" style={{ color: "#b00" }}>
          {error}
        </p>
      )}

      {overview && (
        <>
          <p>
            {overview.summary.kiosksOnline} online · {overview.summary.jobsTotal} jobs (
            {overview.summary.jobsActive} active)
          </p>
          <h2>Kiosks</h2>
          <ul style={{ paddingLeft: 18 }}>
            {overview.kiosks.map((k) => (
              <li key={k.kioskId} style={{ marginBottom: 8 }}>
                <strong>{k.displayName}</strong> <small>({k.kioskId})</small>{" "}
                <small style={{ color: k.online ? "green" : "#888" }}>
                  {k.online ? "● online" : "○ offline"}
                </small>{" "}
                {renaming === k.kioskId ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      maxLength={80}
                      style={{ marginLeft: 8, padding: 4 }}
                    />
                    <button onClick={() => rename(k.kioskId)} style={{ marginLeft: 4 }}>
                      Save
                    </button>
                    <button onClick={() => setRenaming(null)} style={{ marginLeft: 4 }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
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
            <ul style={{ paddingLeft: 18 }}>
              {overview.jobs.map((j) => (
                <li key={j.printJobId}>
                  <small>
                    {j.printJobId.slice(0, 8)} · {j.kioskId} · {j.copies}×{j.color} · {j.status}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h2>Enroll a kiosk</h2>
      <input
        value={enrollId}
        onChange={(e) => setEnrollId(e.target.value)}
        placeholder="kiosk-id"
        style={{ display: "block", marginTop: 4, width: "100%", padding: 8 }}
      />
      <input
        value={enrollName}
        onChange={(e) => setEnrollName(e.target.value)}
        placeholder="Display name (location)"
        maxLength={80}
        style={{ display: "block", marginTop: 8, width: "100%", padding: 8 }}
      />
      <input
        type="password"
        value={enrollToken}
        onChange={(e) => setEnrollToken(e.target.value)}
        placeholder="Enrollment token (operator secret)"
        style={{ display: "block", marginTop: 8, width: "100%", padding: 8 }}
      />
      <button onClick={enroll} style={{ marginTop: 8, padding: "8px 16px" }}>
        Enroll
      </button>
      {oneTime && (
        <section style={{ border: "1px solid #2a2", borderRadius: 8, padding: 12, marginTop: 12 }}>
          <p style={{ margin: "0 0 8px" }}>
            One-time kiosk token (copy now — it won&apos;t be shown again):
          </p>
          <code style={{ wordBreak: "break-all" }}>{oneTime}</code>
          <p style={{ margin: "8px 0 0" }}>
            Save it on the Mini PC as <code>KIOSK_TOKEN</code> in <code>.env</code>.
          </p>
          <button onClick={() => navigator.clipboard.writeText(oneTime)} style={{ marginTop: 8 }}>
            Copy
          </button>
        </section>
      )}
    </main>
  );
}
