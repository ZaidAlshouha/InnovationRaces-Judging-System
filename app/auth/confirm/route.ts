import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseSessionClient } from "@/lib/supabase/server-session-client";

/**
 * GET /auth/confirm
 *
 * The PKCE/SSR token-exchange endpoint Supabase's own docs require for any
 * email-link flow (invite, recovery, signup, magic link) used together with
 * a cookie-based session client — see lib/supabase/server-session-client.ts's
 * own header comment. Exchanges the `token_hash` Supabase Auth put in the
 * invitation email for a real session (stored via this request's response
 * cookies), then redirects the now-authenticated judge to the page where
 * they set their own password
 * (app/judge/activate/page.tsx) — never to any page that could act on
 * their behalf before they've chosen a password.
 *
 * Requires the Supabase project's "Invite" email template to link here
 * instead of the default `{{ .ConfirmationURL }}` (which targets Supabase's
 * own /auth/v1/verify endpoint, not this app) — see this repo's own
 * judge-invitation implementation notes for the exact template line to set
 * in the Supabase Dashboard (Authentication > Email Templates > Invite
 * user): `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/judge/activate`.
 * This route works identically for any other email_otp type (recovery,
 * signup, magic link) that is ever pointed at it the same way — `type` is
 * read from the URL, never hardcoded to "invite" — but only "invite" is
 * wired up by this feature today.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/login";

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (tokenHash && type) {
    const supabase = await getSupabaseSessionClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const errorRedirect = request.nextUrl.clone();
  errorRedirect.pathname = "/login";
  errorRedirect.search = "";
  errorRedirect.searchParams.set("invite_error", "1");
  return NextResponse.redirect(errorRedirect);
}
