-- =============================================================================
-- InnovationRaces Judging System — WhatsApp Automation (Phase F4)
--
-- Adds only what's needed to support n8n-driven WhatsApp notifications
-- (accepted/rejected/group_assigned/reminder) reading from and writing to
-- Supabase, while keeping every existing table's RLS policy untouched.
--
-- Does NOT create a new message table — public.whatsapp_messages
-- (004_application_pipeline.sql) is reused exactly as-is; its schema
-- already matches what this phase needs (application_id, message_type,
-- phone, status, provider_message_id, error_message, sent_at, created_at).
--
-- Does NOT touch hackathons.start_date/end_date, applications, participants,
-- eligibility_results, application_screenings, groups, group_members, or any
-- judging table/RLS policy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. hackathons.event_datetime — the hackathon's actual scheduled start
--    date+time, distinct from the existing start_date/end_date (date-only,
--    describing the whole competition's date range and used elsewhere,
--    e.g. formatDateRangeAr). Nullable: a hackathon may not have this set
--    yet, in which case no reminder can be computed for it (see
--    hackathon_reminder_settings below — the reminder query requires
--    event_datetime IS NOT NULL).
-- -----------------------------------------------------------------------------
alter table public.hackathons add column event_datetime timestamptz;

-- -----------------------------------------------------------------------------
-- 2. hackathon_reminder_settings — one row per hackathon (competition-scoped,
--    per Phase F4 requirement 11), admin-configurable reminder schedule.
--    n8n reads this table fresh on every poll; no timing is hard-coded in
--    the workflow itself.
-- -----------------------------------------------------------------------------
create table public.hackathon_reminder_settings (
  hackathon_id uuid primary key references public.hackathons (id) on delete cascade,
  is_enabled boolean not null default false,
  lead_time_value integer not null default 1 check (lead_time_value > 0),
  lead_time_unit text not null default 'days' check (lead_time_unit in ('hours', 'days')),
  send_at_time time not null default '18:00',
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.hackathon_reminder_settings
  for each row execute function public.set_updated_at();

alter table public.hackathon_reminder_settings enable row level security;

create policy hackathon_reminder_settings_all_admin on public.hackathon_reminder_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.hackathon_reminder_settings to authenticated;
-- No delete grant: a competition's reminder settings are edited in place
-- (upsert-by-hackathon_id), never removed as a row — mirrors
-- eligibility_results' "one current row, no delete method" convention.

-- -----------------------------------------------------------------------------
-- 3. Fix the same missing-authenticated-GRANT bug already found and fixed
--    for applications/eligibility_results/groups/group_members in migrations
--    009 and 010. whatsapp_messages_all_admin RLS (004_application_pipeline.sql)
--    is correct and unchanged; authenticated simply never had base table
--    privilege, so the new read-only "WhatsApp message history" panel on the
--    Applicant Detail page would 403 exactly like every other table did
--    before its fix.
-- -----------------------------------------------------------------------------
grant select on public.whatsapp_messages to authenticated;
-- No insert/update/delete grant for authenticated: only n8n (via its own
-- direct Postgres role/credential, not this HTTP/PostgREST authenticated
-- role) ever writes whatsapp_messages. The admin UI only ever reads
-- message history in this phase.
