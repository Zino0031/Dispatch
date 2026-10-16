import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export function getSupabaseAdmin(): SupabaseClient | undefined {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return undefined;
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function checkSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  const client = getSupabaseAdmin();
  if (!client) return { configured: false, connected: false };

  const { error } = await client.from("kiosks").select("kiosk_id").limit(1);
  return error
    ? { configured: true, connected: false, error: error.message }
    : { configured: true, connected: true };
}