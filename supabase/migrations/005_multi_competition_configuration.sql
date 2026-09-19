-- =============================================================================
-- InnovationRaces Judging System — Multi-Competition Configuration (Phase A)
--
-- Turns `hackathons` into the reusable "competition" entity for the
-- multi-competition platform, per the approved architecture audit — revised
-- after security review to remove all anon access to `clients` (in any
-- form) and to remove client-level branding columns (no consumer needs
-- them; competition/landing branding lives entirely on `hackathons`).
--
-- Nothing in 001-004 is dropped, altered, or replaced:
--   - hackathons: 8 new nullable branding/config columns + is_published
--     (defaulted false — every existing row stays unpublished/unaffected).
--     No new RLS policy is added on the base table itself; anon access is
--     mediated entirely through published_competitions below. The existing
--     hackathons_select_authenticated / hackathons_write_admin policies
--     (001_initial_schema.sql) are untouched — anon still cannot query
--     public.hackathons directly at all.
--   - application_form_questions: 2 new nullable columns (help_text,
--     placeholder), plus the question_type CHECK constraint is dropped and
--     re-created with the same 8 existing values plus 'url' — the only
--     non-purely-additive statement here, and it only widens the allowed
--     set (no existing row's question_type becomes invalid).
--   - clients: UNCHANGED. No new columns, no new policy, no anon access —
--     clients_all_admin (004_application_pipeline.sql) remains the only
--     policy on this table.
--   - public.published_competitions: a new standard (definer-security) view
--     exposing only the columns a public landing page needs from
--     `hackathons`, filtered to is_published = true. It runs with the view
--     owner's privileges, not the querying role's — anon/authenticated are
--     granted SELECT on this view only, never on `hackathons` itself, so
--     there is no path for anon to query `hackathons` directly. Deliberately
--     excludes client_id and status (the internal judging-workflow status:
--     draft / open_for_evaluation / completed / archived — not the same
--     thing as is_published, and not safe to expose verbatim), and —
--     because it is an explicit column whitelist, not `select *` —
--     automatically excludes any column added to hackathons in the future
--     unless this view is deliberately updated to include it.
--   - submit_application() and submit_evaluation(): not referenced, not
--     touched.
--   - Judge-facing RLS (assignments/evaluations/evaluation_scores/judges):
--     untouched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- hackathons: competition configuration columns
-- -----------------------------------------------------------------------------
alter table public.hackathons
  add column slug text,
  add column logo_url text,
  add column hero_image_url text,
  add column primary_color text,
  add column secondary_color text,
  add column accent_color text,
  add column landing_content text,
  add column is_published boolean not null default false;

create unique index hackathons_slug_key on public.hackathons (slug)
  where slug is not null;

-- -----------------------------------------------------------------------------
-- application_form_questions: builder metadata + new question type
-- -----------------------------------------------------------------------------
alter table public.application_form_questions
  add column help_text text,
  add column placeholder text;

alter table public.application_form_questions
  drop constraint application_form_questions_question_type_check;

alter table public.application_form_questions
  add constraint application_form_questions_question_type_check check (
    question_type in (
      'short_text', 'long_text', 'single_choice', 'multi_choice',
      'number', 'email', 'phone', 'file_upload', 'url'
    )
  );

-- -----------------------------------------------------------------------------
-- published_competitions: the ONLY public-facing surface for competition
-- data. Explicit column whitelist — client_id, status (internal judging
-- workflow state), and updated_at are deliberately excluded. This is a
-- standard (definer-security) view: it runs with the VIEW OWNER's
-- privileges, not the querying role's. anon is never granted any privilege
-- on public.hackathons itself — only on this view — so anon can only ever
-- read the columns this view explicitly selects, from rows satisfying this
-- view's own WHERE clause. There is no path for anon to query
-- public.hackathons directly, in whole or in part.
-- -----------------------------------------------------------------------------
create view public.published_competitions
  as
  select
    id,
    name,
    description,
    slug,
    logo_url,
    hero_image_url,
    primary_color,
    secondary_color,
    accent_color,
    landing_content,
    start_date,
    end_date,
    created_at
  from public.hackathons
  where is_published = true;

grant select on public.published_competitions to anon, authenticated;
