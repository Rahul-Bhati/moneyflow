import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client.
 *
 * Credentials live in env vars and never reach the browser:
 *   SUPABASE_URL                  – your project URL
 *   SUPABASE_SERVICE_ROLE_KEY     – the service-role key (server secret)
 *
 * If they aren't set yet, this returns null and the UI shows a setup card
 * instead of crashing.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const isConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
