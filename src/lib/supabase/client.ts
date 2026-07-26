import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("The Supabase browser client cannot be created during server rendering");
  }

  if (!browserClient) {
    const { url, publishableKey } = requireSupabaseConfig();
    browserClient = createBrowserClient(url, publishableKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
