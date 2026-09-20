import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Request-scoped, cookie-based Supabase client for Next.js Route Handlers —
 * the first use of this pattern in this codebase (see
 * lib/supabase/client.ts, which is browser-only, and
 * lib/supabase/server-admin-client.ts, which is service_role-only and never
 * reads a caller's session at all). Follows Supabase's own current
 * documented Next.js App Router pattern exactly (createServerClient +
 * next/headers' cookies(), no deviation).
 *
 * Uses the anon/publishable key — NOT the service_role key — and acts as
 * whichever user's session cookie the request actually carries. RLS is
 * still the real access boundary for any table this client touches, same
 * as the browser client; this exists only so a Route Handler can determine
 * *who* is calling (via getUser(), see requireAdmin() below) and then let
 * that identity's own RLS-gated session perform the write, instead of
 * reaching for the service_role client (which would bypass RLS entirely
 * and is reserved — see server-admin-client.ts — for the one operation
 * that has no RLS-compatible equivalent: the Supabase Auth Admin API).
 *
 * Must be created fresh per request (never cached at module scope) since
 * it closes over this request's specific cookies.
 */
export async function getSupabaseSessionClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY مطلوبان"
    );
  }

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Route Handlers CAN set cookies (unlike Server Components), so
          // this should not normally throw — kept defensive only, matching
          // Supabase's own documented utility exactly.
        }
      },
    },
  });
}
