import type { EvaluationRepository } from "@/lib/data/repositories";
import type { Evaluation, SubmitEvaluationInput } from "@/lib/domain/evaluation";
import { EvaluationStatus } from "@/lib/domain/evaluation";
import { AssignmentStatus } from "@/lib/domain/assignment";
import { supabase, evaluationToDomain } from "./shared";
import type { EvaluationRow, EvaluationScoreRow } from "@/lib/supabase/types";

async function fetchScores(evaluationId: string): Promise<EvaluationScoreRow[]> {
  const { data, error } = await supabase()
    .from("evaluation_scores")
    .select("*")
    .eq("evaluation_id", evaluationId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export class SupabaseEvaluationRepository implements EvaluationRepository {
  async listByHackathon(hackathonId: string): Promise<Evaluation[]> {
    const { data, error } = await supabase()
      .from("evaluations")
      .select("*")
      .eq("hackathon_id", hackathonId);
    if (error) throw new Error(error.message);

    return Promise.all(
      (data ?? []).map(async (row) =>
        evaluationToDomain(row, await fetchScores(row.id))
      )
    );
  }

  async listByJudge(judgeId: string): Promise<Evaluation[]> {
    const { data, error } = await supabase()
      .from("evaluations")
      .select("*")
      .eq("judge_id", judgeId);
    if (error) throw new Error(error.message);

    return Promise.all(
      (data ?? []).map(async (row) =>
        evaluationToDomain(row, await fetchScores(row.id))
      )
    );
  }

  async listByProject(projectId: string): Promise<Evaluation[]> {
    const { data, error } = await supabase()
      .from("evaluations")
      .select("*")
      .eq("project_id", projectId);
    if (error) throw new Error(error.message);

    return Promise.all(
      (data ?? []).map(async (row) =>
        evaluationToDomain(row, await fetchScores(row.id))
      )
    );
  }

  async getByAssignmentId(assignmentId: string): Promise<Evaluation | null> {
    const { data, error } = await supabase()
      .from("evaluations")
      .select("*")
      .eq("assignment_id", assignmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return evaluationToDomain(data, await fetchScores(data.id));
  }

  /**
   * Delegates to the submit_evaluation() SECURITY DEFINER RPC
   * (supabase/migrations/003_submit_evaluation.sql), which performs the
   * evaluation upsert, score replace, and assignment status flip as one
   * atomic transaction inside Postgres — replacing the three sequential
   * client-side table writes this method used to make, which failed under
   * RLS for a judge session (see that migration's header comment for the
   * three specific policy failures this fixes).
   *
   * judgeId is accepted only to satisfy the existing EvaluationRepository
   * interface; it is never sent to the RPC. The caller's true judge
   * identity is re-derived server-side from auth.uid() inside
   * submit_evaluation() itself, which is strictly more correct than
   * trusting a client-supplied judgeId.
   */
  async submit(
    judgeId: string,
    input: SubmitEvaluationInput
  ): Promise<Evaluation> {
    void judgeId;

    // Cast: supabase-js's .rpc()/.single() generic return type resolves to
    // an unresolvable `never` under this project's tsconfig (skipLibCheck +
    // this hand-written Database type) once control-flow narrowing is
    // applied to it — reproduced in isolation outside this file. Casting to
    // the concrete shape once, at this boundary, sidesteps that inference
    // gap without weakening any actual runtime check below.
    const result = (await supabase()
      .rpc("submit_evaluation", {
        p_assignment_id: input.assignmentId,
        p_scores: input.scores.map((s) => ({
          criterion_id: s.criterionId,
          score: s.score,
          comment: s.comment ?? null,
        })),
      })
      .single()) as { data: EvaluationRow | null; error: { message: string } | null };

    if (result.error) {
      throw new Error(result.error.message);
    }
    if (!result.data) {
      throw new Error("تعذّر إرسال التقييم");
    }

    const evaluationRow = result.data;
    return evaluationToDomain(evaluationRow, await fetchScores(evaluationRow.id));
  }

  async reopen(evaluationId: string, actorUserId: string): Promise<Evaluation> {
    void actorUserId; // recorded via the audit log repository by the calling service, not here

    const client = supabase();
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await client
      .from("evaluations")
      .update({ status: EvaluationStatus.Draft, reopened_at: now })
      .eq("id", evaluationId)
      .select("*")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("التقييم غير موجود");

    const { error: assignmentUpdateError } = await client
      .from("assignments")
      .update({ status: AssignmentStatus.InProgress })
      .eq("id", updated.assignment_id);
    if (assignmentUpdateError) throw new Error(assignmentUpdateError.message);

    return evaluationToDomain(updated, await fetchScores(updated.id));
  }
}
