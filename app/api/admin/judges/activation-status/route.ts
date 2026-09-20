import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin-client";
import { requireAdminFromRequest, AdminAuthError } from "@/lib/auth/require-admin-api";

/**
 * POST /api/admin/judges/activation-status
 *
 * Read-only, batched lookup of whether each given judges.user_id has
 * actually confirmed their Supabase Auth account (i.e. clicked the
 * invitation link and set a password) — the real distinction between
 * "invited, still pending" and "invited and activated".
 *
 * Why this exists instead of a DB column: judges.user_id is set the moment
 * the Auth account is CREATED (link_judge_to_existing_auth_user() /
 * handle_new_auth_user(), 002_auth_linkage.sql — both fire at INSERT time),
 * not when the judge actually activates it. auth.users.email_confirmed_at
 * is the real signal, but auth.users is never exposed to the browser
 * client (anon/authenticated have no grant on it — this is Supabase's own
 * schema, not something this app's migrations touch or could safely
 * expose via RLS). service_role's Admin API is the only way to read it,
 * exactly like the invite route itself — see
 * app/api/admin/judges/invite/route.ts's own header comment for the
 * parallel "service_role only for the one operation with no RLS
 * equivalent" design this route repeats for a read instead of a write.
 *
 * Never returns anything from auth.users beyond a plain boolean per id —
 * no email, no metadata, nothing that isn't already visible to this admin
 * via the judges row itself.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const userIds =
    body && typeof body === "object" && "userIds" in body && Array.isArray(body.userIds)
      ? body.userIds.filter((id): id is string => typeof id === "string")
      : null;

  if (!userIds) {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
  }

  // Cap batch size — this route is only ever called with the ids of judges
  // already visible in one page of the admin judges table, never an
  // unbounded/attacker-supplied list.
  if (userIds.length === 0) {
    return NextResponse.json({ activated: {} });
  }
  if (userIds.length > 200) {
    return NextResponse.json({ error: "عدد كبير جدًا من المعرّفات" }, { status: 400 });
  }

  try {
    await requireAdminFromRequest();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[judges/activation-status] admin verification failed:", error);
    return NextResponse.json({ error: "تعذّر التحقق من الصلاحيات" }, { status: 500 });
  }

  const adminClient = getSupabaseAdminClient();
  const activated: Record<string, boolean> = {};

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data, error } = await adminClient.auth.admin.getUserById(userId);
        activated[userId] = !error && Boolean(data.user?.email_confirmed_at);
      } catch {
        // Never let one bad id fail the whole batch — an unresolvable id
        // is treated as "not activated" (the safer default for display),
        // never surfaced as an error to the client.
        activated[userId] = false;
      }
    })
  );

  return NextResponse.json({ activated });
}
