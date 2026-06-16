import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);
export const supabaseUrlLoaded = Boolean(supabaseUrl?.trim());
export const supabaseAnonKeyLoaded = Boolean(supabaseAnonKey?.trim());
export const supabaseClientCreated = Boolean(supabase);

export type SupabaseHealthCheck = {
  success: boolean;
  status?: number;
  message: string;
};

export async function testSupabaseAuthConnection(): Promise<SupabaseHealthCheck> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? JSON.stringify(await response.json()) : await response.text();

    return {
      success: response.ok,
      status: response.status,
      message: response.ok ? "Supabase Auth endpoint reachable." : body || response.statusText,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
