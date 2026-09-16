# Supabase Schema (Future Migration Reference)

This document maps the domain model in `lib/domain/` to the Postgres schema
Supabase will host once the mock-data phase is complete. It is **not
executed** — it is the contract the `lib/data/supabase/*` repositories will
implement against, so the migration is a data-layer swap, not a UI rewrite.

See also: `docs/migration-plan.md` for the step-by-step cutover.

## Entity-relationship overview

```
hackathons
 ├── projects
 ├── judges
 ├── criteria
 └── assignments (judge_id, project_id)
        └── evaluations (one per assignment)
              └── evaluation_scores (one per criterion)
users (Supabase Auth) ──┬── judges (via judges.user_id)
                         └── admins (via users.role = 'admin')
audit_logs
```

Every relationship is by UUID foreign key. No table ever joins on a name
field (`team_name`, `judge_name`, etc.) — this mirrors the mock domain
model's ID-based design in `lib/domain/ids.ts`.

## Tables

### `hackathons`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | default `gen_random_uuid()` |
| name | text, not null | |
| description | text | |
| start_date | date, not null | |
| end_date | date, not null | check `end_date >= start_date` |
| status | text, not null | check in (`draft`, `open_for_evaluation`, `completed`, `archived`) |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()`, updated via trigger |

### `projects`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| hackathon_id | uuid, fk → hackathons.id, not null | `on delete cascade` |
| project_number | int, not null | unique per `hackathon_id` |
| team_name | text, not null | |
| project_name | text, not null | |
| description | text | |
| category | text | |
| project_url | text | |
| demo_url | text | |
| additional_info | text | |
| created_at / updated_at | timestamptz | |

Unique constraint: `(hackathon_id, project_number)`.

### `judges`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| hackathon_id | uuid, fk → hackathons.id, not null | |
| user_id | uuid, fk → auth.users.id, nullable | set once the judge accepts an invite and signs in |
| name | text, not null | |
| email | text, not null | unique per hackathon |
| status | text, not null | check in (`active`, `inactive`) |
| created_at / updated_at | timestamptz | |

`user_id` is populated automatically, not by application code — see
"Auth linkage" below.

### `criteria`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| hackathon_id | uuid, fk → hackathons.id, not null | |
| name | text, not null | |
| description | text | |
| weight | numeric(5,2), not null | check `weight > 0 and weight <= 100` |
| max_score | int, not null | default 10 |
| order | int, not null | default 0, for display ordering |
| created_at / updated_at | timestamptz | |

**Application-level invariant** (enforced in `lib/domain/criterion.ts` today,
and should additionally be enforced by a Postgres trigger or a scheduled
check once live): the sum of `weight` across all criteria for a given
`hackathon_id` must equal 100. This is deliberately not a simple `CHECK`
constraint, since it's a set-level invariant across rows, not a per-row one.

### `assignments`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| hackathon_id | uuid, fk → hackathons.id, not null | |
| judge_id | uuid, fk → judges.id, not null | |
| project_id | uuid, fk → projects.id, not null | |
| status | text, not null | check in (`pending`, `in_progress`, `completed`) |
| assigned_at | timestamptz | default `now()` |
| updated_at | timestamptz | |

Unique constraint: `(judge_id, project_id)` — this is what guarantees no
duplicate assignments at the database level, not just in application code.

### `evaluations`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| hackathon_id | uuid, fk → hackathons.id, not null | |
| assignment_id | uuid, fk → assignments.id, not null, unique | one evaluation per assignment |
| judge_id | uuid, fk → judges.id, not null | denormalized from assignment for simpler RLS |
| project_id | uuid, fk → projects.id, not null | denormalized from assignment for simpler RLS |
| status | text, not null | check in (`draft`, `submitted`) |
| submitted_at | timestamptz | null until first submission |
| reopened_at | timestamptz | set by admin reopen action |
| created_at / updated_at | timestamptz | |

### `evaluation_scores`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| evaluation_id | uuid, fk → evaluations.id, not null | `on delete cascade` |
| criterion_id | uuid, fk → criteria.id, not null | |
| score | numeric(4,2), not null | check `score >= 0 and score <= (select max_score from criteria where id = criterion_id)` (or validated in application layer, since cross-table CHECK isn't portable) |
| comment | text | |

Unique constraint: `(evaluation_id, criterion_id)` — one score per criterion
per evaluation.

### `users`

Backed by Supabase Auth (`auth.users`); this table only stores
application-specific profile data:

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk, fk → auth.users.id | |
| email | text, not null | |
| name | text, not null | |
| role | text, not null | check in (`admin`, `judge`) |

No `judge_id` column: one `auth.users` account can hold multiple `judges`
rows (one per hackathon), so "which judge is this user" can never be a
single scalar link on `users` — see "Auth linkage" below.

### `audit_logs`

| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| hackathon_id | uuid, fk → hackathons.id, not null | |
| action | text, not null | see `AuditAction` enum in `lib/domain/audit-log.ts` |
| actor_user_id | uuid, fk → users.id, not null | |
| actor_name | text, not null | denormalized so history reads correctly even if the user is later removed |
| entity_type | text, not null | e.g. `evaluation`, `judge`, `project` |
| entity_id | uuid, not null | |
| summary | text, not null | Arabic human-readable line, e.g. "أحمد أرسل تقييم فريق Alpha" |
| previous_value | jsonb | |
| new_value | jsonb | |
| created_at | timestamptz | default `now()` |

Audit logs are append-only: no `updated_at`, no update/delete policies for
any role except perhaps a service-role cleanup job.

## Auth linkage (`002_auth_linkage.sql`)

Real Supabase Auth users are never assigned synthetic IDs the way
`lib/data/mock/auth-repository.ts` does (`user-${judge.id}`) — that file stays
mock-only. Production linkage is handled entirely by database triggers, not
application code, so it holds regardless of which client (web app, Supabase
dashboard invite, admin API script) creates the auth user.

**One auth user, many judges rows.** A real person can legitimately be
invited as a judge in more than one hackathon. Each invitation is its own
`judges` row (`judges_email_unique_per_hackathon` makes `(hackathon_id,
email)` the unique key, not `email` alone), and `judges.user_id` has no
uniqueness constraint — many `judges` rows are allowed to reference the same
`auth.users.id`. There is deliberately no `users.judge_id`-style scalar
column anywhere: "which judges row(s) does this signed-in user own" is
always answered by querying `judges where user_id = auth.uid()`, which
returns a set, never assumed to be a single row.

- `handle_new_auth_user()` fires `after insert on auth.users` and: resolves
  `role` from `raw_user_meta_data->>'role'` (defaults to `judge`; must be
  explicitly set to `admin` at invite time — never inferred from email),
  links **every** existing unlinked `judges` row that matches this email
  (not just one — the same person may have pending invites across several
  hackathons), then upserts the corresponding `public.users` row.
- `link_judge_to_existing_auth_user()` fires `before insert on public.judges`
  to cover the reverse ordering (auth user already exists when an admin
  later invites the same person into another hackathon).
- `current_judge_id(p_hackathon_id uuid)` replaces the old zero-argument
  version. Given one auth user can own multiple `judges` rows, "the current
  judge" is only well-defined once scoped to a specific hackathon — every
  caller passes the `hackathon_id` already present on the row being checked
  (`assignments.hackathon_id`, `evaluations.hackathon_id`, or the parent
  evaluation's `hackathon_id` for `evaluation_scores`).
- `is_judge()` complements the existing `is_admin()` for policies that need
  to check judge-ness directly off `public.users`, independent of hackathon.

Admin accounts must be created via `supabase.auth.admin.inviteUserByEmail` /
`createUser` with `{ data: { role: 'admin' } }` in user metadata — there is no
implicit admin-by-email rule in production (unlike the mock repo's
`DEMO_ADMIN` constant).

### Application-layer mirror

`lib/domain/user.ts`'s `User` type mirrors this: `judgeId` (single, optional)
is kept for backward compatibility and is what every judge has today (one
hackathon); `judgeIdsByHackathon` (a `hackathonId -> judgeId` map) is the
general form, with one entry for the common case and more than one only for
a judge who serves multiple hackathons. `app/judge/page.tsx` and
`app/judge/evaluate/[assignmentId]/page.tsx` read `judgeIdsByHackathon` when
present and fall back to `judgeId`, so a single-hackathon judge's behavior is
byte-for-byte unchanged.

## Row Level Security (RLS) — policy intent

RLS is the actual enforcement layer; the frontend hiding UI elements is a UX
convenience only, never the security boundary. Policies below are stated as
intent — exact SQL will be written when Supabase is connected.

- **`hackathons`, `projects`, `criteria`**: readable by any authenticated
  user in the hackathon (needed for judges to see project details); writable
  only by `role = 'admin'`.
- **`judges`**: admins can read/write all judges in their hackathon; a judge
  can read their own row only.
- **`assignments`**: admins have full access. A judge can `select` only rows
  where `assignments.judge_id = current_judge_id(assignments.hackathon_id)`
  — hackathon-scoped, since the same auth user may own a different `judges`
  row (and thus a different set of assignments) per hackathon.
- **`evaluations`**: admins can read all, and can update `status` only via
  the reopen action (never rewrite scores directly). A judge can
  `select`/`insert`/`update` only their own evaluations
  (`evaluations.judge_id = current_judge_id(evaluations.hackathon_id)`), and
  only while `status = 'draft'` — once `submitted`, further writes are
  rejected by policy, not just by application logic.
- **`evaluation_scores`**: inherits the parent evaluation's policy (a judge
  can only touch scores under their own, unlocked evaluation).
- **`audit_logs`**: insert-only for authenticated users (via a server-side
  function, not directly from the client); select restricted to admins.

## What does NOT change when this migration happens

- `lib/domain/*` — the Zod schemas and TypeScript types are the contract;
  Supabase rows are mapped into these shapes by the `lib/data/supabase/*`
  repositories.
- `lib/scoring/engine.ts` — scoring stays 100% client/server-side
  deterministic logic, not a database computed column or a Supabase Edge
  Function, so it remains trivially unit-testable exactly as today.
- Every page/component under `app/` and `components/` — they depend only on
  the repository interfaces in `lib/data/repositories.ts`.
