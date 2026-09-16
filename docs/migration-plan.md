# Migration Plan: Mock Data → Supabase

This is the step-by-step cutover from the Phase 1 mock repositories to real
Supabase-backed ones. None of these steps are performed yet — this document
exists so the migration is a checklist, not a redesign, when the time comes.

## 1. Prerequisites

- Supabase project created; connection URL + anon/service keys available.
- `docs/supabase-schema.md` tables created via SQL migration files.
- RLS policies from that document applied and tested with the Supabase SQL
  editor / `psql` before any application code depends on them.

## 2. Implement Supabase repositories — done

Implemented under `lib/data/supabase/` (one class per interface in
`lib/data/repositories.ts`), sharing mappers/helpers from
`lib/data/supabase/shared.ts`:

- Every method uses the singleton **browser client**
  (`lib/supabase/client.ts`, via `@supabase/ssr`'s `createBrowserClient`) —
  not a service-role key — since the app is entirely client-rendered today
  (no middleware, no server components gating routes). This means RLS always
  sees the signed-in user's real `auth.uid()`, never an elevated session.
  A server/SSR client was deliberately not added in this phase — see the
  note below.
- Postgres snake_case rows are mapped to camelCase domain types via
  `*ToDomain()` functions in `shared.ts`, typed against
  `lib/supabase/types.ts` (hand-written to match
  `001_initial_schema.sql` + `002_auth_linkage.sql`, not CLI-generated).
- Known failures are re-thrown as the same Arabic Error messages the mock
  repositories throw (duplicate assignment, not-found, wrong-judge,
  already-submitted), via `translatePostgresError()` in `shared.ts` or
  inline checks, so UI error handling doesn't need to change.
- **Known gap:** `SupabaseEvaluationRepository.submit()` performs its
  evaluation-upsert, score-replace, and assignment-status-flip as three
  sequential client calls, not one atomic transaction — documented in that
  file. Closing this requires a Postgres RPC (e.g. `submit_evaluation()`)
  that has not been written or run against the database yet. This is the
  one piece of step 2 intentionally deferred to a future phase; it does not
  block using the Supabase backend, since a mid-sequence failure only risks
  a brief, self-evident status mismatch (evaluation submitted, assignment
  still `in_progress`), not data loss or incorrect scoring.
- Not yet added: a server/SSR Supabase client, middleware, or converting any
  page to a server component. `RequireRole` (`lib/auth/require-role.tsx`)
  continues to be the only route guard, exactly as before — RLS remains the
  actual security boundary, not route-level gating.

## 3. Swap the composition root — done, but flag-gated rather than hardcoded

`lib/data/index.ts` now reads `NEXT_PUBLIC_DATA_BACKEND` and constructs
either the `Mock*` or `Supabase*` instance per repository, defaulting to
`mock` when unset (see step 6 — this flag is being kept permanently, not
just as a transitional step). Nothing else imports the mock or Supabase
classes directly.

## 4. Replace mock auth with Supabase Auth — done

- `SupabaseAuthRepository implements AuthRepository`
  (`lib/data/supabase/auth-repository.ts`), backed by
  `supabase.auth.signInWithPassword` / `getUser()` / `signOut()`.
- `buildDomainUser()` (`lib/data/supabase/shared.ts`) resolves the full
  `User` after sign-in: reads `public.users` for role/name, then **every**
  `public.judges` row linked to that auth identity (not just one), to
  populate both `judgeId` (first/primary, back-compat) and
  `judgeIdsByHackathon` (the full per-hackathon map) — see "Auth linkage" in
  `docs/supabase-schema.md`. `app/judge/page.tsx` and
  `app/judge/evaluate/[assignmentId]/page.tsx` already consume
  `judgeIdsByHackathon` generically, so no further app changes were needed.
- The `judges` table gains real rows tied to `auth.users` via `user_id` once
  each judge accepts an invite and creates an account — this linkage is
  handled automatically by the `002_auth_linkage.sql` triggers
  (`handle_new_auth_user`, `link_judge_to_existing_auth_user`), not by
  application code.
- Admin accounts are created via `supabase.auth.admin.inviteUserByEmail` /
  `createUser` with `{ data: { role: 'admin' } }`; judge invites omit `role`
  (defaults to `judge` in the trigger).
- `lib/data/mock/auth-repository.ts` is **not removed** — it remains the
  default backend and stays available indefinitely per step 6.
- No changes were needed to `lib/auth/auth-context.tsx`,
  `lib/auth/require-role.tsx`, or any component calling
  `authRepository.signIn(...)` / `useAuth()` — same interface, different
  implementation, exactly as planned.

## 5. Seed real data

- Either write a one-time SQL seed script derived from the shape of
  `mock-data/*.ts` (useful for demo/staging), or have the admin recreate
  the real hackathon/projects/judges/criteria through the Admin UI once
  Supabase is live — the UI already supports full CRUD for all of these.

## 6. Keep mock mode available

- Gate the composition root behind an environment flag
  (`DATA_BACKEND=mock|supabase`) so demos, local development without
  Supabase credentials, and the existing test suite can keep using the mock
  repositories indefinitely. The Vitest suite in particular should stay on
  mock repositories — it asserts on deterministic seeded data.

## 7. Verify parity before removing mock code

- Re-run every Vitest suite currently passing against the mock repos as
  equivalent integration tests against a Supabase test project (or a local
  Supabase instance via the CLI), particularly:
  - duplicate assignment rejection (now enforced by both app code and the
    `(judge_id, project_id)` unique constraint)
  - submit → assignment flips to `completed`
  - reopen → assignment flips back to `in_progress`, resubmission works
  - rankings exclude incomplete projects
- Only delete `lib/data/mock/*` once the Supabase path has full parity and
  the flag from step 6 is no longer needed (or keep it permanently for
  local dev/tests — recommended).
