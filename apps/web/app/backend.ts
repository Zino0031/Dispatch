/** Resolve the API base (docs/OPERATIONS.md: web origin must be in backend CORS_ORIGIN or same LAN). */
export function backendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return `${protocol}//${hostname}:4000`;
    return `${protocol}//${hostname}:4000`;
  }
  return "http://localhost:4000";
}
