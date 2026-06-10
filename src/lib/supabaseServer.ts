import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export const isConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

export interface UserSupabase {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Per-request Supabase client bound to the current Clerk session.
 * The session JWT is forwarded so Postgres RLS evaluates
 * `auth.jwt() ->> 'sub'` against the Clerk user id.
 *
 * Returns null when the request is unauthenticated, the user has no token,
 * or Supabase env vars are missing — callers must handle this.
 */
export async function getSupabaseForUser(): Promise<UserSupabase | null> {
  if (!isConfigured()) return null;

  const { userId, getToken } = await auth();
  if (!userId) return null;

  const token = await getToken();
  if (!token) return null;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return { supabase, userId };
}
