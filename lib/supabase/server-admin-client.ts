import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * The ONLY place in this app that uses the service_role (secret) key.
 * `import "server-only"` makes any accidental import from client code a
 * build-time error, not just a code-review concern — see
 * https://www.npmjs.com/package/server-only (bundled with Next.js).
 *
 * Used exclusively by app/api/applications/* route handlers to call
 * Supabase Storage's createSignedUploadUrl()/remove() — operations that
 * must run with elevated privilege because the applicant has no Supabase
 * Auth session at all (this app's public flow is entirely anonymous; see
 * lib/domain/public-application.ts). service_role bypasses RLS entirely by
 * design, which is why every route that uses this client must do its own
 * authorization check first (verifying the application/question ownership
 * via the anon-key-scoped repositories) before calling anything here.
 *
 * Never import this from lib/data/supabase/* (those stay anon-key-only,
 * used by the browser) or from any "use client" component.
 */
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبان لتفعيل رفع الملفات"
    );
  }

  adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return adminClient;
}
