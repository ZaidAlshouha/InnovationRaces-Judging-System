-- =============================================================================
-- InnovationRaces Judging System — submit_evaluation() RPC
--
-- Replaces SupabaseEvaluationRepository.submit()'s three sequential
-- client-side table writes (upsert evaluations as 'submitted', replace
-- evaluation_scores, update assignments to 'completed'), which fail under
-- 001_initial_schema.sql + 002_auth_linkage.sql's RLS policies for three
-- independent reasons:
--   1. evaluations_insert_own_draft's WITH CHECK requires status = 'draft'
--      on INSERT — a judge session can never insert a row already
--      'submitted'.
--   2. evaluation_scores_insert_own_draft's WITH CHECK requires the parent
--      evaluation to still be 'draft' at the moment scores are written —
--      but the evaluation is already 'submitted' by the time scores would
--      be written in the old sequential flow.
--   3. assignments has no judge-scoped UPDATE policy at all — only
--      assignments_update_admin (admin-only) — so a judge session can
--      never flip their own assignment to 'completed'.
--
-- p_scores is parsed exactly ONCE via jsonb_to_recordset into a temporary
-- table, and that same materialized, typed result is reused for every
-- validation step and for the final insert — no second, independent
-- parsing path exists anywhere in this function.
--
-- The caller's judge identity is derived solely from auth.uid() via
-- current_judge_id(hackathon_id) (002_auth_linkage.sql) — never from any
-- client-supplied judge_id — so a judge cannot submit on behalf of another
-- judge, and a judge who belongs to a different hackathon (but not this
-- assignment's hackathon) is correctly rejected.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_evaluation(
  p_assignment_id uuid,
  p_scores jsonb
)
RETURNS public.evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.assignments%ROWTYPE;
  v_caller_judge_id uuid;
  v_existing public.evaluations%ROWTYPE;
  v_evaluation public.evaluations%ROWTYPE;
  v_now timestamptz := now();
  v_score_count integer;
  v_distinct_criterion_count integer;
  v_unknown_criterion_count integer;
BEGIN
  SELECT *
  INTO v_assignment
  FROM public.assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'التوزيع غير موجود' USING ERRCODE = 'P0001';
  END IF;

  v_caller_judge_id := public.current_judge_id(v_assignment.hackathon_id);

  IF v_caller_judge_id IS NULL OR v_assignment.judge_id <> v_caller_judge_id THEN
    RAISE EXCEPTION 'لا يمكنك إرسال تقييم لتوزيع لا يخصك' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.evaluations
  WHERE assignment_id = p_assignment_id;

  IF FOUND AND v_existing.status = 'submitted' THEN
    RAISE EXCEPTION 'تم إرسال هذا التقييم مسبقًا، يرجى مراجعة المسؤول لإعادة فتحه' USING ERRCODE = 'P0001';
  END IF;

  CREATE TEMPORARY TABLE tmp_submit_scores ON COMMIT DROP AS
  SELECT *
  FROM jsonb_to_recordset(p_scores) AS s(
    criterion_id uuid,
    score numeric,
    comment text
  );

  SELECT count(*)
  INTO v_score_count
  FROM tmp_submit_scores;

  IF v_score_count = 0 THEN
    RAISE EXCEPTION 'يجب تقييم معيار واحد على الأقل' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_submit_scores
    WHERE criterion_id IS NULL
       OR score IS NULL
       OR score < 0
       OR score > 10
  ) THEN
    RAISE EXCEPTION 'الدرجة يجب أن تكون بين 0 و 10' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(DISTINCT criterion_id)
  INTO v_distinct_criterion_count
  FROM tmp_submit_scores;

  IF v_distinct_criterion_count <> v_score_count THEN
    RAISE EXCEPTION 'لا يمكن تكرار نفس المعيار أكثر من مرة في التقييم' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)
  INTO v_unknown_criterion_count
  FROM tmp_submit_scores s
  LEFT JOIN public.criteria c
    ON c.id = s.criterion_id
    AND c.hackathon_id = v_assignment.hackathon_id
  WHERE c.id IS NULL;

  IF v_unknown_criterion_count > 0 THEN
    RAISE EXCEPTION 'معيار غير معروف لهذا الهاكاثون' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.evaluations (
    id,
    hackathon_id,
    assignment_id,
    judge_id,
    project_id,
    status,
    submitted_at,
    created_at,
    updated_at
  )
  VALUES (
    COALESCE(v_existing.id, gen_random_uuid()),
    v_assignment.hackathon_id,
    v_assignment.id,
    v_assignment.judge_id,
    v_assignment.project_id,
    'submitted',
    v_now,
    COALESCE(v_existing.created_at, v_now),
    v_now
  )
  ON CONFLICT (assignment_id) DO UPDATE
  SET status = 'submitted',
      submitted_at = v_now,
      updated_at = v_now
  WHERE public.evaluations.status <> 'submitted'
  RETURNING * INTO v_evaluation;

  -- Closes the concurrent double-submit race: if two requests from the same
  -- judge for the same assignment overlap, the second one's INSERT blocks
  -- on the unique-constraint conflict until the first commits, then
  -- re-evaluates this WHERE clause against the now-committed row. If that
  -- row is already 'submitted', the update is skipped, RETURNING yields no
  -- row, and FOUND is false here — exactly the same signal a non-racing
  -- already-submitted attempt produces via the earlier SELECT/IF FOUND
  -- check, so both paths reject with the same message.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'تم إرسال هذا التقييم مسبقًا، يرجى مراجعة المسؤول لإعادة فتحه' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.evaluation_scores
  WHERE evaluation_id = v_evaluation.id;

  INSERT INTO public.evaluation_scores (
    evaluation_id,
    criterion_id,
    score,
    comment
  )
  SELECT
    v_evaluation.id,
    criterion_id,
    score,
    comment
  FROM tmp_submit_scores;

  UPDATE public.assignments
  SET status = 'completed'
  WHERE id = v_assignment.id;

  RETURN v_evaluation;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_evaluation(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(uuid, jsonb) TO authenticated;
