import type { AssignmentRepository } from "@/lib/data/repositories";
import type { Assignment, CreateAssignmentInput } from "@/lib/domain/assignment";
import { supabase, assignmentToDomain, translatePostgresError } from "./shared";

export class SupabaseAssignmentRepository implements AssignmentRepository {
  async listByHackathon(hackathonId: string): Promise<Assignment[]> {
    const { data, error } = await supabase()
      .from("assignments")
      .select("*")
      .eq("hackathon_id", hackathonId);

    if (error) throw new Error(error.message);
    return (data ?? []).map(assignmentToDomain);
  }

  async listByJudge(judgeId: string): Promise<Assignment[]> {
    const { data, error } = await supabase()
      .from("assignments")
      .select("*")
      .eq("judge_id", judgeId);

    if (error) throw new Error(error.message);
    return (data ?? []).map(assignmentToDomain);
  }

  async listByProject(projectId: string): Promise<Assignment[]> {
    const { data, error } = await supabase()
      .from("assignments")
      .select("*")
      .eq("project_id", projectId);

    if (error) throw new Error(error.message);
    return (data ?? []).map(assignmentToDomain);
  }

  async getById(id: string): Promise<Assignment | null> {
    const { data, error } = await supabase()
      .from("assignments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? assignmentToDomain(data) : null;
  }

  async create(input: CreateAssignmentInput): Promise<Assignment> {
    const { data, error } = await supabase()
      .from("assignments")
      .insert({
        hackathon_id: input.hackathonId,
        judge_id: input.judgeId,
        project_id: input.projectId,
      })
      .select("*")
      .single();

    if (error) {
      throw translatePostgresError(error, { duplicateAssignment: true });
    }
    return assignmentToDomain(data);
  }

  /**
   * Bulk assignment is idempotent by design (see
   * lib/data/mock/assignment-repository.ts): duplicates against existing or
   * concurrently-created rows are skipped silently rather than aborting the
   * whole batch. The (judge_id, project_id) unique constraint is the actual
   * backstop; each row is inserted individually so one duplicate can't fail
   * the rest.
   */
  async createMany(inputs: CreateAssignmentInput[]): Promise<Assignment[]> {
    const created: Assignment[] = [];
    for (const input of inputs) {
      const { data, error } = await supabase()
        .from("assignments")
        .insert({
          hackathon_id: input.hackathonId,
          judge_id: input.judgeId,
          project_id: input.projectId,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") continue; // duplicate — skip silently
        throw new Error(error.message);
      }
      created.push(assignmentToDomain(data));
    }
    return created;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase().from("assignments").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
