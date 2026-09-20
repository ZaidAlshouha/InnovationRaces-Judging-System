import "server-only";
import { getSupabaseSessionClient } from "@/lib/supabase/server-session-client";

/**
 * Server-side admin-authorization check for Next.js Route Handlers — the
 * API-route equivalent of RequireRole (lib/auth/require-role.tsx), which is
 * explicitly documented as "a UX convenience only" and NOT a security
 * boundary (see its own header comment). A Route Handler that performs a
 * privileged, non-RLS-expressible operation (like inviting a Supabase Auth
 * user) has no RLS to fall back on for that specific call, so it MUST
 * verify the caller itself — this is that check.
 *
 * Verification sequence:
 *   1. getUser() against the caller's own session cookie — always
 *      round-trips to the Auth server to validate the JWT (same trust
 *      level the existing SupabaseAuthRepository.getCurrentUser() already
 *      relies on client-side; never trusts a decoded-but-unverified token).
 *   2. A `public.users.role = 'admin'` lookup for that verified user id —
 *      the exact same check public.is_admin() performs at the database
 *      level, just run here so the route can refuse *before* ever touching
 *      the service_role client.
 *
 * Returns the verified admin's user id (for audit-log attribution) or
 * throws AdminAuthError, which every caller maps to a generic Arabic 401/
 * 403 — never leaking whether the failure was "not signed in" vs
 * "signed in but not admin" to the response body (both collapse to the
 * same public message; the distinction is only in the thrown error for
 * server-side logging).
 */
export class AdminAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export async function requireAdminFromRequest(): Promise<{
  userId: string;
  email: string;
}> {
  const supabase = await getSupabaseSessionClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AdminAuthError("لم يتم تسجيل الدخول", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    throw new AdminAuthError("هذا الإجراء متاح للمسؤولين فقط", 403);
  }

  return { userId: user.id, email: user.email ?? "" };
}
