"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { backendUrl } from "./backend";

interface JobEvent {
  event: string;
  message?: string;
  position?: number;
  at: string;
}

const TERMINAL = new Set(["PRINT_SUCCESS", "ERROR", "PRINTER_ERROR", "CANCELLED"]);

function labelFor(event: string): string {
  switch (event) {
    case "QUEUED":
      return "Queued";
    case "SENT_TO_KIOSK":
      return "Sent to printer";
    case "DOWNLOAD_START":
      return "Printer downloading file…";
    case "DOWNLOAD_COMPLETE":
      return "File received, preparing…";
    case "PRINTING_STARTED":
      return "Printing…";
    case "PRINT_SUCCESS":
      return "Done — collect your pages";
    case "ERROR":
    case "PRINTER_ERROR":
      return "Something went wrong";
    case "CANCELLED":
      return "Cancelled";
    default:
      return event;
  }
}

/**
 * Live job timeline over a user-role socket (issue #4).
 * Never stalls silently: disconnect shows "Live connection lost" with
 * Reconnect + Check status (REST fallback). Terminal events close the socket.
 * Realtime auth via accessToken lands in issue #13 (v1 uses printJobId only).
 */
export default function LiveTracking({
  printJobId,
  jobToken,
  onRetry,
}: {
  printJobId: string;
  jobToken: string | null;
  onRetry: () => void;
}) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [live, setLive] = useState(true);
  const [lost, setLost] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    socketRef.current?.disconnect();
    setLost(false);
    setLive(true);
    if (!jobToken) {
      // Shouldn't happen (token comes from the 201 response) — never hang.
      setLost(true);
      setLive(false);
      return;
    }
    const socket = io(backendUrl(), {
      auth: { role: "user", printJobId, token: jobToken },
      transports: ["websocket"],
    });
    socketRef.current = socket;
    socket.on("JOB_STATUS", (msg: JobEvent) => {
      setEvents((prev) => {
        if (prev.some((e) => e.event === msg.event && e.at === msg.at)) return prev;
        return [...prev, msg];
      });
      if (TERMINAL.has(msg.event)) {
        socket.disconnect();
        setLive(false);
      }
    });
    socket.on("disconnect", () => {
      setEvents((prev) => {
        const done = prev.some((e) => TERMINAL.has(e.event));
        if (!done) setLost(true);
        return prev;
      });
      setLive(false);
    });
    socket.on("connect_error", () => {
      setLost(true);
      setLive(false);
    });
  }, [printJobId, jobToken]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [connect]);

  const checkStatus = async () => {
    if (!jobToken || checking) return;
    setChecking(true);
    try {
      const res = await fetch(`${backendUrl()}/api/print-job/${printJobId}`, {
        headers: { "x-print-job-token": jobToken },
      });
      if (!res.ok) throw new Error(`status check failed (${res.status})`);
      const data = (await res.json()) as { history?: JobEvent[] };
      if (Array.isArray(data.history)) setEvents(data.history);
    } catch {
      // Keep the socket state as the source of truth; check is best-effort.
    } finally {
      setChecking(false);
    }
  };

  const last = events[events.length - 1];
  const failed = last?.event === "ERROR" || last?.event === "PRINTER_ERROR";
  const done = last?.event === "PRINT_SUCCESS";
  const cancelled = last?.event === "CANCELLED";
  const queued = last?.event === "QUEUED" && !cancelled;
  const stalled =
    failed &&
    typeof last?.message === "string" &&
    /stalled|disconnected mid-print/i.test(last.message);
  const position = typeof last?.position === "number" ? last.position : null;

  const cancel = async () => {
    if (!jobToken || cancelling) return;
    setCancelling(true);
    const res = await fetch(`${backendUrl()}/api/print-job/${printJobId}`, {
      method: "DELETE",
      headers: { "x-print-job-token": jobToken },
    });
    setCancelling(false);
    if (res.ok) {
      socketRef.current?.disconnect();
      setLive(false);
      await checkStatus();
    }
  };

  return (
    <section aria-live="polite" className="panel">
      <h2>
        {done ? "Printed ✓" : failed ? "Print failed" : cancelled ? "Cancelled" : "Printing…"}
      </h2>
      {queued && position !== null && position > 0 && (
        <p>
          <span className="pill">Position in queue: #{position + 1}</span> ({position} ahead of you)
        </p>
      )}
      {lost && !done && (
        <div className="panel panel-error" style={{ margin: "0 0 12px" }}>
          <p>Live connection lost… tap Reconnect to retry.</p>
          <button className="btn-secondary" onClick={connect} style={{ marginRight: 8 }}>
            Reconnect
          </button>
          <button className="btn-secondary" onClick={checkStatus} disabled={checking || !jobToken}>
            {checking ? "Checking…" : "Check status"}
          </button>
        </div>
      )}
      <ol className="timeline">
        {events.map((e, i) => (
          <li key={`${e.event}-${e.at}-${i}`}>
            <strong>{labelFor(e.event)}</strong>{" "}
            <time>{new Date(e.at).toLocaleTimeString()}</time>
            {e.message && <div className={failed ? "msg-error" : "msg"}>{e.message}</div>}
          </li>
        ))}
      </ol>
      {events.length === 0 && !lost && <p>Waiting for printer updates…</p>}
      {failed && (
        <>
          {stalled && (
            <p className="notice-amber">
              The printer disconnected — check with staff before paying again.
            </p>
          )}
          <button className="btn-secondary" onClick={onRetry} style={{ marginTop: 12 }}>
            Send again
          </button>
        </>
      )}
      {queued && (
        <button className="btn-secondary" onClick={cancel} disabled={cancelling || !jobToken} style={{ marginTop: 12 }}>
          {cancelling ? "Cancelling…" : "Cancel this job"}
        </button>
      )}
      {done && <p>Job <span className="mono">{printJobId.slice(0, 8)}</span> complete.</p>}
      {cancelled && <p>Job cancelled — nothing was printed.</p>}
      {!live && !done && !failed && !lost && <p>Connection closed.</p>}
    </section>
  );
}
