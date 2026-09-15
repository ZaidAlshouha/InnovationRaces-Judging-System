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
  where `assignments.judge_id`'s `judges.user_id = auth.uid()`.
- **`evaluations`**: admins can read all, and can update `status` only via
  the reopen action (never rewrite scores directly). A judge can
  `select`/`insert`/`update` only their own evaluations
  (`evaluations.judge_id → judges.user_id = auth.uid()`), and only while
  `status = 'draft'` — once `submitted`, further writes are rejected by
  policy, not just by application logic.
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
