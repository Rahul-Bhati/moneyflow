"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getFunDisposableError } from "@/lib/disposableEmails";

export async function signInWithEmail(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signUpWithEmail(
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;

  const funError = getFunDisposableError(email);
  if (funError) return { error: funError };

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) return { error: error.message };
  return { success: "Check your inbox — confirmation link is on its way! 🚀" };
}

export async function signInWithOAuth(
  provider: "google" | "apple"
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) return { error: error.message };
  if (data.url) redirect(data.url);
}
