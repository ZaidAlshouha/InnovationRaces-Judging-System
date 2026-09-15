# Migration Plan: Mock Data → Supabase

This is the step-by-step cutover from the Phase 1 mock repositories to real
Supabase-backed ones. None of these steps are performed yet — this document
exists so the migration is a checklist, not a redesign, when the time comes.

## 1. Prerequisites

- Supabase project created; connection URL + anon/service keys available.
- `docs/supabase-schema.md` tables created via SQL migration files.
- RLS policies from that document applied and tested with the Supabase SQL
  editor / `psql` before any application code depends on them.

## 2. Implement Supabase repositories

For each interface in `lib/data/repositories.ts`, add a matching class under
`lib/data/supabase/`, e.g. `SupabaseProjectRepository implements
ProjectRepository`. Each method:

- Uses the Supabase JS client (`@supabase/supabase-js`) scoped to the
  request (server component / route handler client, not a shared singleton,
  so RLS sees the correct `auth.uid()`).
- Maps Postgres snake_case rows to the camelCase domain types via a small
  `toDomain(row)` mapper function per repository — keeps the domain layer
  ignorant of the wire format.
- Re-throws Postgres/RLS errors as the same domain-level Error messages the
  mock repositories already throw (e.g. "هذا المحكّم مُعيّن بالفعل لهذا
  المشروع"), so UI error handling doesn't need to change.

## 3. Swap the composition root

`lib/data/index.ts` currently exports `new Mock*Repository()` instances.
Change each line to `new Supabase*Repository()` — one file, one diff. Do this
per-repository if useful (e.g. migrate `ProjectRepository` first, verify,
then `JudgeRepository`), since nothing else imports the mock classes
directly.

## 4. Replace mock auth with Supabase Auth

- Add `SupabaseAuthRepository implements AuthRepository`, backed by
  `supabase.auth.signInWithPassword` (or magic link, if preferred for
  judges).
- The `judges` table gains real rows tied to `auth.users` via `user_id` once
  each judge accepts an invite and creates an account.
- Remove `lib/data/mock/auth-repository.ts`'s localStorage session hack;
  session state comes from Supabase's own client-side session management.
- No changes needed to any component that calls `authRepository.signIn(...)`
  or `useCurrentUser()` — same interface, different implementation.

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
