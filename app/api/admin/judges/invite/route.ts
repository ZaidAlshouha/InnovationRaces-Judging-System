import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin-client";
import { getSupabaseSessionClient } from "@/lib/supabase/server-session-client";
import { requireAdminFromRequest, AdminAuthError } from "@/lib/auth/require-admin-api";
import { inviteJudgeInputSchema } from "@/lib/domain/judge-invitation";
import { InviteJudgeOutcome } from "@/lib/domain/judge-invitation";

/**
 * POST /api/admin/judges/invite
 *
 * The ONLY place in this app that calls Supabase Auth's Admin API
 * (auth.admin.inviteUserByEmail) — a service_role-only operation with no
 * RLS-expressible equivalent, exactly like
 * app/api/applications/upload-url/route.ts is the only caller of
 * createSignedUploadUrl() for the same reason (see that route's own header
 * comment for the parallel design).
 *
 * Authorization boundary: requireAdminFromRequest() verifies the caller is
 * a signed-in admin BEFORE this route does anything privileged — service_role
 * is never reached for an unauthenticated or non-admin caller. This is a
 * genuinely new pattern for this codebase (no existing route reads a
 * caller's session; see lib/supabase/server-session-client.ts's own header
 * comment), required because "invite this email to Supabase Auth" has no
 * RLS policy that could gate it the way every other admin write in this
 * app is gated.
 *
 * Writing the `judges` row itself is deliberately NOT done with the
 * service_role client — it goes through a second, session-authenticated
 * client (getSupabaseSessionClient(), acting as the verified admin's own
 * session) so the existing judges_write_admin/judges_update_admin RLS
 * policies (001_initial_schema.sql) remain the actual enforcement for that
 * write, exactly as they already are for every other admin judges-table
 * write in this app (JudgeFormDialog's plain create/edit path). This means
 * a bug in requireAdminFromRequest() alone could never let a non-admin
 * write a judges row — RLS would still refuse it independently. service_role
 * (and therefore this route's elevated privilege) is scoped to exactly the
 * one call that has no alternative: the Auth invite itself.
 *
 * Handles, without ever creating a duplicate Auth user or judges row:
 *   - New judge + new Auth account            -> InviteJudgeOutcome.Created
 *   - Existing judge row for this exact        -> InviteJudgeOutcome.AlreadyAssigned
 *     (hackathon, email) pair
 *   - New judges row, but an Auth account       -> InviteJudgeOutcome.LinkedToExistingAccount
 *     already exists for this email (from
 *     another hackathon or a prior invite)
 * The judges_email_unique_per_hackathon constraint (001_initial_schema.sql)
 * is the authoritative duplicate check for the second case — this route
 * checks for it first (via getByEmail-equivalent) only to return a clear,
 * non-generic outcome rather than relying solely on catching the
 * constraint violation.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = inviteJudgeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات الطلب غير صالحة" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // 1. Authorization — must happen before any privileged client is ever
  // constructed for this request.
  let admin: { userId: string; email: string };
  try {
    admin = await requireAdminFromRequest();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[judges/invite] admin verification failed:", error);
    return NextResponse.json({ error: "تعذّر التحقق من الصلاحيات" }, { status: 500 });
  }
  // Server-side diagnostic trail only (never returned to the client) —
  // the user-facing audit_logs entry is written by the caller
  // (InviteJudgeDialog, via useRecordAuditAction()) after a successful
  // response, matching this codebase's existing convention for every
  // other admin mutation (see lib/queries/use-audit-log.ts's own header
  // note: the calling mutation hook records the audit entry, not the
  // repository/route itself).
  console.log(
    `[judges/invite] admin ${admin.userId} (${admin.email}) inviting ${input.email} to hackathon ${input.hackathonId}`
  );

  const session = await getSupabaseSessionClient();

  // 2. Verify the target hackathon exists and is visible to this admin
  // session (RLS-gated select — an admin can see every hackathon, but this
  // still guards against a stale/tampered id resolving to nothing, per the
  // "never trust a submitted id alone" requirement).
  const { data: hackathon, error: hackathonError } = await session
    .from("hackathons")
    .select("id")
    .eq("id", input.hackathonId)
    .maybeSingle();

  if (hackathonError) {
    console.error("[judges/invite] hackathon lookup failed:", hackathonError.message);
    return NextResponse.json({ error: "تعذّر التحقق من الهاكاثون" }, { status: 500 });
  }
  if (!hackathon) {
    return NextResponse.json({ error: "الهاكاثون المحدد غير موجود" }, { status: 404 });
  }

  // 3. Reject a duplicate (hackathon, email) assignment up front, with a
  // clear outcome — judges_email_unique_per_hackathon would also catch
  // this at insert time, but checking first avoids an avoidable failed
  // insert and lets us distinguish "already assigned here" from other
  // insert failures.
  const normalizedEmail = input.email.trim().toLowerCase();
  const { data: existingForHackathon, error: existingError } = await session
    .from("judges")
    .select("id, user_id, status")
    .eq("hackathon_id", input.hackathonId)
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    console.error("[judges/invite] existing-judge lookup failed:", existingError.message);
    return NextResponse.json({ error: "تعذّر التحقق من بيانات المحكّم" }, { status: 500 });
  }

  if (existingForHackathon) {
    // Already assigned to this exact hackathon. If they're still unlinked
    // (never activated), re-sending the invite is a reasonable, safe
    // recovery action — inviteUserByEmail is itself idempotent-ish (resends
    // the invite email for a still-pending user; Supabase returns an error
    // only if the account is already fully registered/confirmed, which we
    // treat the same as "already active" below and simply skip re-sending).
    let invitationSent = false;
    if (!existingForHackathon.user_id) {
      const admin_client = getSupabaseAdminClient();
      const { error: inviteError } = await admin_client.auth.admin.inviteUserByEmail(
        input.email,
        {
          data: { role: "judge", name: input.name },
          redirectTo: buildActivationRedirectUrl(request),
        }
      );
      invitationSent = !inviteError;
      if (inviteError) {
        console.error("[judges/invite] re-invite failed:", inviteError.message);
      }
    }

    return NextResponse.json({
      judgeId: existingForHackathon.id,
      outcome: InviteJudgeOutcome.AlreadyAssigned,
      invitationSent,
    });
  }

  // 4. Create the judges row through the ADMIN'S OWN SESSION (RLS-gated,
  // not service_role) — see this route's own header comment for why.
  // on_judge_insert_link_auth_user (002_auth_linkage.sql) runs BEFORE this
  // INSERT and sets user_id immediately if an auth.users row already
  // exists for this email — no manual lookup needed here.
  const { data: createdJudge, error: createError } = await session
    .from("judges")
    .insert({
      hackathon_id: input.hackathonId,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      notes: input.notes || null,
      status: "active",
    })
    .select("id, user_id")
    .single();

  if (createError || !createdJudge) {
    console.error("[judges/invite] judges insert failed:", createError?.message);
    if (createError?.code === "23505") {
      return NextResponse.json(
        { error: "هذا المحكّم مُعيّن بالفعل لهذا الهاكاثون" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "تعذّر إنشاء حساب المحكّم" }, { status: 500 });
  }

  // 5. If the trigger already linked this row to an existing Auth account
  // (same email used for a different hackathon, or a prior invite), that
  // person can already sign in — do not send a second invitation email or
  // attempt to re-create their Auth account.
  if (createdJudge.user_id) {
    return NextResponse.json({
      judgeId: createdJudge.id,
      outcome: InviteJudgeOutcome.LinkedToExistingAccount,
      invitationSent: false,
    });
  }

  // 6. Genuinely new — invite a brand-new Auth account. service_role is
  // touched for exactly this one call. `data.role: "judge"` is what
  // handle_new_auth_user() (002_auth_linkage.sql) reads to link every
  // unlinked judges row for this email and upsert public.users with the
  // correct role — see that trigger's own definition for the exact
  // behavior this relies on.
  const adminClient = getSupabaseAdminClient();
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: { role: "judge", name: input.name },
      redirectTo: buildActivationRedirectUrl(request),
    }
  );

  if (inviteError) {
    // The judges row already exists and is valid at this point — never
    // roll it back or delete it just because the invitation email failed
    // to send. The admin can retry sending the invitation later (re-invite
    // path above); the judge record itself, and this admin's audit trail
    // of having created it, must not be lost over an email-delivery
    // failure. Never leak Supabase's own error message to the client.
    console.error("[judges/invite] inviteUserByEmail failed:", inviteError.message);
    return NextResponse.json({
      judgeId: createdJudge.id,
      outcome: InviteJudgeOutcome.Created,
      invitationSent: false,
    });
  }

  return NextResponse.json({
    judgeId: createdJudge.id,
    outcome: InviteJudgeOutcome.Created,
    invitationSent: true,
  });
}

/**
 * The `redirectTo` passed to inviteUserByEmail — becomes `{{ .RedirectTo }}`
 * in the Supabase "Invite" email template. This route's job is only to
 * carry that final destination through; the template itself must link to
 * this app's own /auth/confirm endpoint first (see app/auth/confirm/route.ts's
 * header comment for the exact template line required) so the token_hash
 * can be exchanged for a session server-side before the judge ever reaches
 * this URL. Points at /judge/activate — the page where a freshly-verified,
 * still-passwordless judge sets their own password (never straight to
 * /judge, which requires an existing password-based session).
 */
function buildActivationRedirectUrl(request: Request): string {
  return new URL("/judge/activate", request.url).toString();
}
