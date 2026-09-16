-- =============================================================================
-- InnovationRaces Judging System — Initial Schema
--
-- Maps 1:1 onto the domain models in lib/domain/*.ts and the interfaces in
-- lib/data/repositories.ts. See docs/supabase-schema.md for the design
-- rationale this migration implements.
--
-- Scope: schema + RLS only. No data is seeded here (see docs/migration-plan.md
-- step 5). Mock repositories under lib/data/mock/* are untouched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every row update
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- users
--
-- Profile row for every authenticated principal (admin or judge), keyed to
-- Supabase Auth. lib/domain/user.ts: { id, email, name, role, judgeId? }.
-- judge_id is nullable and only meaningful when role = 'judge'; it is kept in
-- sync with judges.user_id (see judges table) rather than duplicating the
-- link direction as the source of truth.
-- =============================================================================
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('admin', 'judge')),
  judge_id uuid, -- fk added after judges table exists (see below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'Application profile data layered on auth.users; role drives RLS everywhere else.';

create trigger set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- =============================================================================
-- hackathons
-- lib/domain/hackathon.ts
-- =============================================================================
create table public.hackathons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'open_for_evaluation', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hackathons_end_after_start check (end_date >= start_date)
);

create trigger set_updated_at
  before update on public.hackathons
  for each row execute function public.set_updated_at();

-- =============================================================================
-- projects
-- lib/domain/project.ts
-- =============================================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  project_number integer not null check (project_number > 0),
  team_name text not null,
  project_name text not null,
  description text,
  category text,
  project_url text,
  demo_url text,
  additional_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_number_unique_per_hackathon unique (hackathon_id, project_number)
);

create index projects_hackathon_id_idx on public.projects (hackathon_id);

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- =============================================================================
-- judges
-- lib/domain/judge.ts
--
-- user_id is nullable: a judge can be created by the admin (name + email)
-- before that person ever signs in. It is populated once the judge's auth
-- identity is linked (see docs/migration-plan.md step 4).
-- =============================================================================
create table public.judges (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint judges_email_unique_per_hackathon unique (hackathon_id, email)
);

create index judges_hackathon_id_idx on public.judges (hackathon_id);
create index judges_user_id_idx on public.judges (user_id);

create trigger set_updated_at
  before update on public.judges
  for each row execute function public.set_updated_at();

-- Now that judges exists, wire users.judge_id to it.
alter table public.users
  add constraint users_judge_id_fkey
  foreign key (judge_id) references public.judges (id) on delete set null;

create index users_judge_id_idx on public.users (judge_id);

-- =============================================================================
-- criteria
-- lib/domain/criterion.ts
--
-- The "weights across a hackathon's criteria sum to 100" invariant is a
-- set-level check across sibling rows, not expressible as a per-row CHECK.
-- It stays enforced in lib/domain/criterion.ts::validateCriteriaWeights, per
-- docs/supabase-schema.md. Not re-implemented as a trigger here to avoid
-- diverging from that documented decision without sign-off.
-- =============================================================================
create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  name text not null,
  description text,
  weight numeric(5, 2) not null check (weight > 0 and weight <= 100),
  max_score integer not null default 10 check (max_score > 0),
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index criteria_hackathon_id_idx on public.criteria (hackathon_id);

create trigger set_updated_at
  before update on public.criteria
  for each row execute function public.set_updated_at();

-- =============================================================================
-- assignments
-- lib/domain/assignment.ts
--
-- (judge_id, project_id) uniqueness is the database-level backstop for
-- isDuplicateAssignment() in lib/domain/assignment.ts.
-- =============================================================================
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  judge_id uuid not null references public.judges (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_judge_project_unique unique (judge_id, project_id)
);

create index assignments_hackathon_id_idx on public.assignments (hackathon_id);
create index assignments_judge_id_idx on public.assignments (judge_id);
create index assignments_project_id_idx on public.assignments (project_id);

create trigger set_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- evaluations
-- lib/domain/evaluation.ts
--
-- judge_id / project_id are denormalized from the parent assignment (as
-- documented in docs/supabase-schema.md) purely to keep RLS policies simple
-- (no join through assignments needed to check ownership).
-- =============================================================================
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  judge_id uuid not null references public.judges (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index evaluations_hackathon_id_idx on public.evaluations (hackathon_id);
create index evaluations_judge_id_idx on public.evaluations (judge_id);
create index evaluations_project_id_idx on public.evaluations (project_id);

create trigger set_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- evaluation_scores
-- lib/domain/evaluation.ts (evaluationScoreSchema)
--
-- Score range is validated 0..10 at the Zod/domain layer today
-- (DEFAULT_MAX_SCORE in lib/domain/criterion.ts), NOT against the specific
-- criterion's own max_score. Mirrored here as a fixed CHECK rather than a
-- cross-table lookup — see "Assumptions" in the report for why this may need
-- revisiting if criteria ever use a max_score other than 10.
-- =============================================================================
create table public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  criterion_id uuid not null references public.criteria (id) on delete restrict,
  score numeric(4, 2) not null check (score >= 0 and score <= 10),
  comment text,
  constraint evaluation_scores_unique_per_criterion unique (evaluation_id, criterion_id)
);

create index evaluation_scores_evaluation_id_idx on public.evaluation_scores (evaluation_id);
create index evaluation_scores_criterion_id_idx on public.evaluation_scores (criterion_id);

-- =============================================================================
-- audit_logs
-- lib/domain/audit-log.ts
--
-- Append-only: no updated_at, no update/delete policy for any authenticated
-- role.
-- =============================================================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  action text not null check (action in (
    'evaluation_submitted',
    'evaluation_reopened',
    'judge_created',
    'judge_updated',
    'project_created',
    'project_updated',
    'assignment_created',
    'assignment_removed',
    'criterion_created',
    'criterion_updated',
    'hackathon_created',
    'hackathon_updated'
  )),
  actor_user_id uuid not null references public.users (id) on delete restrict,
  actor_name text not null,
  entity_type text not null,
  entity_id uuid not null,
  summary text not null,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_hackathon_id_idx on public.audit_logs (hackathon_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.users enable row level security;
alter table public.hackathons enable row level security;
alter table public.projects enable row level security;
alter table public.judges enable row level security;
alter table public.criteria enable row level security;
alter table public.assignments enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: is the current auth user an admin? SECURITY DEFINER + STABLE so it
-- can be reused across every policy below without recursive RLS evaluation
-- on public.users itself.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: the judges.id row (if any) owned by the current auth user.
create or replace function public.current_judge_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.judges where user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- users: a user can read their own row; admins can read all. Only a
-- service-role context (not exposed here) creates/updates profile rows.
-- -----------------------------------------------------------------------------
create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- hackathons: readable by any authenticated user; writable only by admins.
-- -----------------------------------------------------------------------------
create policy hackathons_select_authenticated on public.hackathons
  for select to authenticated
  using (true);

create policy hackathons_write_admin on public.hackathons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- projects: readable by any authenticated user (judges need project details);
-- writable only by admins.
-- -----------------------------------------------------------------------------
create policy projects_select_authenticated on public.projects
  for select to authenticated
  using (true);

create policy projects_write_admin on public.projects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- criteria: readable by any authenticated user; writable only by admins.
-- -----------------------------------------------------------------------------
create policy criteria_select_authenticated on public.criteria
  for select to authenticated
  using (true);

create policy criteria_write_admin on public.criteria
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- judges: admins have full access; a judge can read their own row only.
-- -----------------------------------------------------------------------------
create policy judges_select_admin on public.judges
  for select to authenticated
  using (public.is_admin());

create policy judges_select_self on public.judges
  for select to authenticated
  using (user_id = auth.uid());

create policy judges_write_admin on public.judges
  for insert to authenticated
  with check (public.is_admin());

create policy judges_update_admin on public.judges
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy judges_delete_admin on public.judges
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- assignments: admins have full access. A judge can only select assignments
-- that belong to them.
-- -----------------------------------------------------------------------------
create policy assignments_select_admin on public.assignments
  for select to authenticated
  using (public.is_admin());

create policy assignments_select_own on public.assignments
  for select to authenticated
  using (judge_id = public.current_judge_id());

create policy assignments_write_admin on public.assignments
  for insert to authenticated
  with check (public.is_admin());

create policy assignments_update_admin on public.assignments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy assignments_delete_admin on public.assignments
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- evaluations: admins can read all and reopen (update). A judge can
-- select/insert/update only their own evaluations, and only while status is
-- still 'draft' — once submitted, further judge writes are rejected by
-- policy. Reopening (submitted -> draft) is an admin-only transition, done
-- via the reopen() repository method under the admin's session.
-- -----------------------------------------------------------------------------
create policy evaluations_select_admin on public.evaluations
  for select to authenticated
  using (public.is_admin());

create policy evaluations_select_own on public.evaluations
  for select to authenticated
  using (judge_id = public.current_judge_id());

create policy evaluations_insert_own_draft on public.evaluations
  for insert to authenticated
  with check (
    judge_id = public.current_judge_id()
    and status = 'draft'
  );

create policy evaluations_update_own_while_draft on public.evaluations
  for update to authenticated
  using (
    judge_id = public.current_judge_id()
    and status = 'draft'
  )
  with check (
    judge_id = public.current_judge_id()
  );

create policy evaluations_update_admin on public.evaluations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- evaluation_scores: inherits the parent evaluation's policy — a judge may
-- only touch scores under their own, unlocked (draft) evaluation; admins
-- have full read access.
-- -----------------------------------------------------------------------------
create policy evaluation_scores_select_admin on public.evaluation_scores
  for select to authenticated
  using (public.is_admin());

create policy evaluation_scores_select_own on public.evaluation_scores
  for select to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id()
    )
  );

create policy evaluation_scores_insert_own_draft on public.evaluation_scores
  for insert to authenticated
  with check (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id()
        and e.status = 'draft'
    )
  );

create policy evaluation_scores_update_own_draft on public.evaluation_scores
  for update to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id()
        and e.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id()
        and e.status = 'draft'
    )
  );

create policy evaluation_scores_delete_own_draft on public.evaluation_scores
  for delete to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id()
        and e.status = 'draft'
    )
  );

-- -----------------------------------------------------------------------------
-- audit_logs: insert-only for authenticated users; select restricted to
-- admins. No update/delete policy exists for any authenticated role (only a
-- service-role connection, which bypasses RLS entirely, could clean these up).
-- -----------------------------------------------------------------------------
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

create policy audit_logs_insert_authenticated on public.audit_logs
  for insert to authenticated
  with check (actor_user_id = auth.uid());
