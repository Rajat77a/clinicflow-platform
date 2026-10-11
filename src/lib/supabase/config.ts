import { sessionIdleTimeoutMs } from "../session-timeout";

const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

const supabaseUrl = (
  env.VITE_SUPABASE_URL ||
  env.VITE_PUBLIC_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();

const supabasePublishableKey = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_KEY ||
  ""
).trim();

export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
  appUrl: env.VITE_CLINICFLOW_APP_URL?.trim() || "http://localhost:3000",
  sessionIdleTimeoutMs: sessionIdleTimeoutMs(
    env.VITE_CLINICFLOW_SESSION_IDLE_MINUTES,
  ),
  configured: Boolean(supabaseUrl && supabasePublishableKey),
  demoMode:
    env.VITE_CLINICFLOW_DEMO_MODE === "true" ||
    !(supabaseUrl && supabasePublishableKey),
} as const;

export function requireSupabaseConfig() {
  if (!supabaseConfig.configured) {
    throw new Error("Supabase is not configured for this deployment");
  }

  return {
    url: supabaseConfig.url,
    publishableKey: supabaseConfig.publishableKey,
  };
}
