-- =============================================================================
-- InnovationRaces Judging System — Real Auth Linkage (multi-hackathon judges)
--
-- Resolves the actor_user_id / judge auth-linkage gap left open by
-- 001_initial_schema.sql, WITHOUT assuming a single auth.users account maps
-- to exactly one judges row. A real person can legitimately be invited as a
-- judge in multiple hackathons (each hackathon has its own judges row, per
-- judges_email_unique_per_hackathon in 001_initial_schema.sql), and one
-- auth.users account must be able to link to all of them.
--
-- judges.user_id -> auth.users.id already supports this correctly in
-- 001_initial_schema.sql as written (no uniqueness constraint on
-- judges.user_id, so many judges rows may reference the same auth user).
-- The only things that were wrong lived entirely in this file:
--   1. A "public.users.judge_id" scalar column, which cannot represent one
--      auth user holding several judges rows. It is NOT introduced here.
--   2. handle_new_auth_user() matching only ONE unlinked judges row by email
--      ("order by created_at asc limit 1"), silently abandoning the rest.
--      Fixed to link every matching unlinked row for that email.
--   3. current_judge_id() (defined in 001_initial_schema.sql) returning a
--      bare scalar with no hackathon scoping, which is ambiguous — and
--      would error at runtime ("more than one row returned by a subquery")
--      the moment one auth user has two judges rows. Redefined here to take
--      a hackathon_id parameter; every RLS policy that called the old
--      zero-arg version is updated in this same file to pass hackathon_id.
--
-- Neither 001_initial_schema.sql's tables nor its non-judge-scoping policies
-- (hackathons/projects/criteria selects, admin-only writes, audit_logs) are
-- touched — see the "RLS policies re-created" section below for the exact
-- list of policies this migration replaces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- handle_new_auth_user()
--
-- Fires after every INSERT into auth.users (real sign-up, invite acceptance,
-- or admin-created account via the Supabase Auth API). Creates the matching
-- public.users row and links EVERY pre-existing, unlinked judges row that
-- shares this email — not just one — since the same person may have been
-- invited as a judge in several hackathons before ever signing in.
--
-- Role resolution:
--   - raw_user_meta_data->>'role' = 'admin'  -> role = 'admin'
--   - otherwise                              -> role = 'judge'
-- Admins are never inferred from email; they must be explicitly created with
-- { data: { role: 'admin' } } in the invite/signup call (via
-- supabase.auth.admin.inviteUserByEmail / createUser), matching how
-- lib/data/mock/auth-repository.ts's DEMO_ADMIN is a deliberate, explicit
-- record rather than a pattern match.
--
-- public.users carries no judge_id column: "which judges row(s) belong to
-- this signed-in user" is answered on demand by querying
-- judges where user_id = auth.uid(), never by a cached scalar link.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'judge');
  if v_role not in ('admin', 'judge') then
    v_role := 'judge';
  end if;

  v_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  if v_role = 'judge' then
    -- Link every unlinked judges row for this email, across all hackathons —
    -- deliberately not "limit 1". Disambiguation is by (hackathon_id, email),
    -- which judges_email_unique_per_hackathon already guarantees is unique;
    -- email alone is expected to match multiple rows and that is correct.
    update public.judges
    set user_id = new.id
    where lower(email) = lower(new.email)
      and user_id is null;
  end if;

  insert into public.users (id, email, name, role)
  values (new.id, new.email, v_name, v_role)
  on conflict (id) do update
    set email = excluded.email,
        name = excluded.name,
        role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- handle_auth_user_email_change()
--
-- Keeps public.users.email in sync if a user changes their auth email later.
-- Judge linkage is intentionally NOT re-run here: existing judges.user_id
-- links are fixed at first sign-in and must not silently repoint just
-- because someone edited their auth email afterward. (A future hackathon
-- invite under the new email will link normally via the trigger below.)
-- -----------------------------------------------------------------------------
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- -----------------------------------------------------------------------------
-- Backstop: if a judges row is created AFTER its matching auth.users row
-- already exists (e.g. an admin invites the same person into a second
-- hackathon after that person already has an account), link it immediately
-- instead of waiting for another auth.users insert that will never come.
-- This fires per new judges row, so it naturally supports one auth user
-- accumulating any number of judges rows over time.
-- -----------------------------------------------------------------------------
create or replace function public.link_judge_to_existing_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
begin
  if new.user_id is null then
    select id into v_auth_user_id
    from auth.users
    where lower(email) = lower(new.email)
    limit 1;

    if v_auth_user_id is not null then
      new.user_id := v_auth_user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_judge_insert_link_auth_user on public.judges;
create trigger on_judge_insert_link_auth_user
  before insert on public.judges
  for each row execute function public.link_judge_to_existing_auth_user();

-- -----------------------------------------------------------------------------
-- current_judge_id(p_hackathon_id)
--
-- Replaces the zero-argument current_judge_id() from 001_initial_schema.sql.
-- The old version returned a bare scalar with no way to disambiguate between
-- multiple judges rows for the same auth user, and would raise "more than
-- one row returned by a subquery used as an expression" the moment a real
-- user judged two hackathons. Every table that needs judge ownership
-- (assignments, evaluations, and evaluation_scores via its parent
-- evaluation) already carries hackathon_id on the row being checked, so
-- policies can pass it in for free — no extra join required.
--
-- CREATE OR REPLACE cannot change a function's parameter list, so the old
-- signature is dropped first. CASCADE removes the policies that still
-- reference the zero-arg version; every one of them is re-created below with
-- the hackathon-scoped call, so nothing is left dangling.
-- -----------------------------------------------------------------------------
drop function if exists public.current_judge_id() cascade;

create function public.current_judge_id(p_hackathon_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.judges
  where user_id = auth.uid()
    and hackathon_id = p_hackathon_id;
$$;

-- -----------------------------------------------------------------------------
-- is_judge()
--
-- Companion to the existing is_admin() from 001_initial_schema.sql, so RLS
-- policies (and any future ones) can check judge-ness directly off
-- public.users instead of relying solely on current_judge_id() returning
-- non-null. Hackathon-agnostic by design: "is this person a judge at all"
-- is a role question, not a per-hackathon membership question.
-- -----------------------------------------------------------------------------
create or replace function public.is_judge()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'judge'
  );
$$;

-- =============================================================================
-- RLS policies re-created against current_judge_id(hackathon_id)
--
-- drop function ... cascade above already removed these five policies
-- (their definitions in 001_initial_schema.sql called the zero-arg
-- current_judge_id()). Re-created here verbatim except for the added
-- hackathon_id argument. No other policy from 001_initial_schema.sql is
-- touched.
-- =============================================================================

-- assignments_select_own: a judge can select assignments that belong to
-- them, scoped to the assignment's own hackathon.
create policy assignments_select_own on public.assignments
  for select to authenticated
  using (judge_id = public.current_judge_id(hackathon_id));

-- evaluations_select_own
create policy evaluations_select_own on public.evaluations
  for select to authenticated
  using (judge_id = public.current_judge_id(hackathon_id));

-- evaluations_insert_own_draft
create policy evaluations_insert_own_draft on public.evaluations
  for insert to authenticated
  with check (
    judge_id = public.current_judge_id(hackathon_id)
    and status = 'draft'
  );

-- evaluations_update_own_while_draft
create policy evaluations_update_own_while_draft on public.evaluations
  for update to authenticated
  using (
    judge_id = public.current_judge_id(hackathon_id)
    and status = 'draft'
  )
  with check (
    judge_id = public.current_judge_id(hackathon_id)
  );

-- evaluation_scores_select_own (joins through evaluations for hackathon_id,
-- since evaluation_scores itself carries no hackathon_id column)
create policy evaluation_scores_select_own on public.evaluation_scores
  for select to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id(e.hackathon_id)
    )
  );

-- evaluation_scores_insert_own_draft
create policy evaluation_scores_insert_own_draft on public.evaluation_scores
  for insert to authenticated
  with check (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id(e.hackathon_id)
        and e.status = 'draft'
    )
  );

-- evaluation_scores_update_own_draft
create policy evaluation_scores_update_own_draft on public.evaluation_scores
  for update to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id(e.hackathon_id)
        and e.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id(e.hackathon_id)
        and e.status = 'draft'
    )
  );

-- evaluation_scores_delete_own_draft
create policy evaluation_scores_delete_own_draft on public.evaluation_scores
  for delete to authenticated
  using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_scores.evaluation_id
        and e.judge_id = public.current_judge_id(e.hackathon_id)
        and e.status = 'draft'
    )
  );

-- -----------------------------------------------------------------------------
-- judges_select_self: unaffected by the hackathon-scoping change (it filters
-- on judges.user_id directly, not via current_judge_id()), but re-stated
-- here for completeness since a judge with multiple rows must be able to
-- read all of their own judges rows across hackathons, which this already
-- does correctly with no changes needed.
-- -----------------------------------------------------------------------------
-- (no-op — judges_select_self from 001_initial_schema.sql is untouched)
