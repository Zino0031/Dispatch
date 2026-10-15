import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Optional admin client — null when unconfigured (docs/ARCHITECTURE.md). */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    client = null;
    return client;
  }
  // Service-role key only: reject publishable values (docs/GUIDELINES.md).
  if (key.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a secret key, not sb_publishable_");
  }
  client = createClient(url, key);
  return client;
}
