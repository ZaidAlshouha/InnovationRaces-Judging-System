import { z } from "zod";
import { judgePhoneSchema } from "./judge";

/**
 * Input/output shapes for the judge-invitation flow — POST
 * /api/admin/judges/invite (app/api/admin/judges/invite/route.ts). Kept
 * separate from lib/domain/judge.ts's createJudgeInputSchema (used by the
 * plain "add a judges row" path) because this flow does more than insert a
 * row: it also creates/invites the corresponding Supabase Auth account, so
 * its own validation is the server route's authoritative contract, not a
 * client-side convenience only.
 */
export const inviteJudgeInputSchema = z.object({
  hackathonId: z.string().min(1, "الهاكاثون مطلوب"),
  name: z.string().min(1, "اسم المحكّم مطلوب").max(200, "الاسم طويل جدًا"),
  email: z.string().email("بريد إلكتروني غير صالح").max(320),
  phone: judgePhoneSchema,
  notes: z.string().max(2000, "الملاحظات طويلة جدًا").optional(),
});

export type InviteJudgeInput = z.infer<typeof inviteJudgeInputSchema>;

/**
 * Every outcome the route can report, distinguished so the admin UI can
 * show an accurate toast/status rather than a single generic
 * "created successfully" for cases that are meaningfully different (e.g. a
 * re-invite of someone who never activated, vs a genuinely new account).
 * Mirrors the task's own required states: "New judge + new Auth account",
 * "Existing Auth user + new judge assignment", "Existing judge + additional
 * hackathon assignment".
 */
export const InviteJudgeOutcome = {
  /** New judges row + a brand-new Auth account was invited. */
  Created: "created",
  /** A judges row already existed for this exact (hackathon, email) pair — no duplicate was created; its invitation was (re-)sent if it was still unlinked. */
  AlreadyAssigned: "already_assigned",
  /** New judges row was created for this hackathon, linked to an Auth account that already existed for this email (from another hackathon, or a prior invite) — no new invitation email is sent since they can already sign in. */
  LinkedToExistingAccount: "linked_to_existing_account",
} as const;

export type InviteJudgeOutcome =
  (typeof InviteJudgeOutcome)[keyof typeof InviteJudgeOutcome];

export interface InviteJudgeResult {
  judgeId: string;
  outcome: InviteJudgeOutcome;
  /** True only when a real invitation e-mail was actually sent by this call. */
  invitationSent: boolean;
}

/**
 * Admin-facing account states, derived from data this app already has —
 * no new "invitation status" column was added, per the task's explicit "do
 * not invent database fields if unnecessary; derive it safely from Auth/
 * user information where possible" instruction.
 *
 * Two signals, not one:
 *   - judges.user_id: set the moment an Auth account is CREATED — either
 *     by link_judge_to_existing_auth_user() (a judges row inserted for an
 *     email that already has an Auth account) or handle_new_auth_user()
 *     (a brand-new Auth account just invited), both 002_auth_linkage.sql,
 *     both firing at INSERT time. This alone is NOT "activated" — it only
 *     means an Auth account exists and is linked.
 *   - `activated` (this function's second parameter): whether that Auth
 *     account has actually been confirmed (the judge clicked the invite
 *     link and set a password) — auth.users.email_confirmed_at, which is
 *     never exposed to the browser client and is fetched, only for judges
 *     currently on screen, via POST /api/admin/judges/activation-status
 *     (service_role, read-only — see that route's own header comment).
 *     Optional/undefined here means "not yet looked up" — callers that
 *     have not fetched activation status yet should treat undefined as
 *     "assume pending" (the conservative default) rather than "assume
 *     active", which is exactly what the `?? false` below does.
 */
export const JudgeAccountState = {
  /** userId is set, activated is true, status is 'active' — normal, usable account. */
  Active: "active",
  /** userId is set, activated is true, status is 'inactive' — admin-disabled; the judge's Auth account still exists but this app's own gates (see lib/auth/require-role.tsx) should treat them as not permitted. */
  Disabled: "disabled",
  /** userId is null, OR userId is set but the Auth account has not been confirmed yet — invited but has not yet completed activation (never clicked the invite link / never set a password). */
  PendingActivation: "pending_activation",
} as const;

export type JudgeAccountState =
  (typeof JudgeAccountState)[keyof typeof JudgeAccountState];

export function deriveJudgeAccountState(
  judge: {
    userId?: string;
    status: "active" | "inactive";
  },
  /** From POST /api/admin/judges/activation-status's `activated` map, keyed by judge.userId. Undefined (not yet fetched) is treated the same as `false`. */
  activated?: boolean
): JudgeAccountState {
  if (!judge.userId || !(activated ?? false)) {
    return JudgeAccountState.PendingActivation;
  }
  return judge.status === "active"
    ? JudgeAccountState.Active
    : JudgeAccountState.Disabled;
}

export const JUDGE_ACCOUNT_STATE_LABELS_AR: Record<JudgeAccountState, string> = {
  [JudgeAccountState.Active]: "نشط",
  [JudgeAccountState.Disabled]: "مُعطّل",
  [JudgeAccountState.PendingActivation]: "بانتظار التفعيل",
};

export const JUDGE_ACCOUNT_STATE_LABELS_EN: Record<JudgeAccountState, string> = {
  [JudgeAccountState.Active]: "Active",
  [JudgeAccountState.Disabled]: "Disabled",
  [JudgeAccountState.PendingActivation]: "Pending Activation",
};
