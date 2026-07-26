const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
  appUrl: import.meta.env.VITE_CLINICFLOW_APP_URL?.trim() || "http://localhost:3000",
  configured: Boolean(supabaseUrl && supabasePublishableKey),
  demoMode:
    import.meta.env.VITE_CLINICFLOW_DEMO_MODE === "true" ||
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
