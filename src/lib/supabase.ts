import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);
export const supabaseUrlLoaded = Boolean(supabaseUrl?.trim());
export const supabaseAnonKeyLoaded = Boolean(supabaseAnonKey?.trim());
export const supabaseClientCreated = Boolean(supabase);

function getSupabaseUrlDiagnostics() {
  if (!supabaseUrl) return { host: "missing", path: "", valid: false, issue: "missing URL" };
  try {
    const parsed = new URL(supabaseUrl);
    const invalidPath = parsed.pathname !== "/" && parsed.pathname !== "";
    return {
      host: parsed.host,
      path: parsed.pathname,
      valid: parsed.protocol.startsWith("http") && !invalidPath,
      issue: invalidPath ? "URL must be the project root, not /rest/v1 or /auth/v1." : "",
    };
  } catch {
    return { host: "invalid", path: "", valid: false, issue: "malformed URL" };
  }
}

const urlDiagnostics = getSupabaseUrlDiagnostics();

export const supabaseDiagnosticInfo = {
  urlHost: urlDiagnostics.host,
  urlPath: urlDiagnostics.path,
  urlLooksValid: urlDiagnostics.valid,
  urlIssue: urlDiagnostics.issue,
  keyLength: supabaseAnonKey?.trim().length || 0,
  keyPrefixLength: supabaseAnonKey?.trim().split(".")[0]?.length || 0,
  clientCreated: supabaseClientCreated,
  sdkCreateClientUsage: "createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)",
};

export type SupabaseHealthCheck = {
  success: boolean;
  getSession: {
    success: boolean;
    message: string;
  };
  getUser: {
    success: boolean;
    message: string;
  };
  request: {
    endpoint: string;
    authMethod: string;
    headersSent: string[];
  };
  message: string;
};

export async function testSupabaseAuthConnection(): Promise<SupabaseHealthCheck> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      getSession: { success: false, message: "Not run." },
      getUser: { success: false, message: "Not run." },
      request: { endpoint: "Supabase SDK auth methods", authMethod: "none", headersSent: [] },
      message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  if (!supabase) {
    return {
      success: false,
      getSession: { success: false, message: "Not run." },
      getUser: { success: false, message: "Not run." },
      request: { endpoint: `${supabaseUrl.replace(/\/$/, "")}/auth/v1/*`, authMethod: "Supabase SDK", headersSent: ["apikey", "Authorization when a session exists"] },
      message: "Supabase client was not created.",
    };
  }

  try {
    const sessionResult = await supabase.auth.getSession();
    const userResult = await supabase.auth.getUser();
    const getSession = {
      success: !sessionResult.error,
      message: sessionResult.error?.message || (sessionResult.data.session ? "Session found." : "No active session."),
    };
    const getUser = {
      success: !userResult.error || userResult.error.name === "AuthSessionMissingError",
      message: userResult.error?.message || (userResult.data.user ? "User found." : "No active user."),
    };

    return {
      success: getSession.success && getUser.success,
      getSession,
      getUser,
      request: {
        endpoint: `${supabaseUrl.replace(/\/$/, "")}/auth/v1 via supabase.auth.getSession() and supabase.auth.getUser()`,
        authMethod: "Supabase JS SDK v2 auth client",
        headersSent: ["apikey: <anon key>", "Authorization: Bearer <session access token when available>"],
      },
      message: [getSession.message, getUser.message].join(" | "),
    };
  } catch (error) {
    return {
      success: false,
      getSession: { success: false, message: "Exception before completion." },
      getUser: { success: false, message: "Exception before completion." },
      request: {
        endpoint: `${supabaseUrl.replace(/\/$/, "")}/auth/v1 via Supabase JS SDK`,
        authMethod: "Supabase JS SDK v2 auth client",
        headersSent: ["apikey: <anon key>", "Authorization: Bearer <session access token when available>"],
      },
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
