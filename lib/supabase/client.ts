import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Singleton browser client. The app is entirely client-rendered today (no
 * middleware, no server components gating routes — see RequireRole in
 * lib/auth/require-role.tsx), so every Supabase repository shares this one
 * request-scoped-by-session client rather than a service-role key. Row
 * Level Security (supabase/migrations/001_initial_schema.sql,
 * 002_auth_linkage.sql) is the actual access boundary; this client only
 * ever acts as the signed-in user.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY مطلوبان عند استخدام NEXT_PUBLIC_DATA_BACKEND=supabase"
    );
  }

  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
