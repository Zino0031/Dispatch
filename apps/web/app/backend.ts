export function backendUrl(): string {
  const env = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (env) return env.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://localhost:4000";
  const { hostname, protocol } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]") {
    return `${protocol}//${hostname}:4000`;
  }
  return `${protocol}//${hostname}:4000`;
}
