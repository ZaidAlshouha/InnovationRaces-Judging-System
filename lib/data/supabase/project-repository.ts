import type { ProjectRepository } from "@/lib/data/repositories";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/domain/project";
import { supabase, projectToDomain } from "./shared";

export class SupabaseProjectRepository implements ProjectRepository {
  async listByHackathon(hackathonId: string): Promise<Project[]> {
    const { data, error } = await supabase()
      .from("projects")
      .select("*")
      .eq("hackathon_id", hackathonId)
      .order("project_number", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(projectToDomain);
  }

  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase()
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? projectToDomain(data) : null;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const { data, error } = await supabase()
      .from("projects")
      .insert({
        hackathon_id: input.hackathonId,
        project_number: input.projectNumber,
        team_name: input.teamName,
        project_name: input.projectName,
        description: input.description ?? null,
        category: input.category ?? null,
        project_url: input.projectUrl || null,
        demo_url: input.demoUrl || null,
        additional_info: input.additionalInfo ?? null,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "تعذّر إنشاء المشروع");
    return projectToDomain(data);
  }

  async update(input: UpdateProjectInput): Promise<Project> {
    const { id, ...rest } = input;
    const { data, error } = await supabase()
      .from("projects")
      .update({
        ...(rest.hackathonId !== undefined && { hackathon_id: rest.hackathonId }),
        ...(rest.projectNumber !== undefined && {
          project_number: rest.projectNumber,
        }),
        ...(rest.teamName !== undefined && { team_name: rest.teamName }),
        ...(rest.projectName !== undefined && { project_name: rest.projectName }),
        ...(rest.description !== undefined && {
          description: rest.description ?? null,
        }),
        ...(rest.category !== undefined && { category: rest.category ?? null }),
        ...(rest.projectUrl !== undefined && {
          project_url: rest.projectUrl || null,
        }),
        ...(rest.demoUrl !== undefined && { demo_url: rest.demoUrl || null }),
        ...(rest.additionalInfo !== undefined && {
          additional_info: rest.additionalInfo ?? null,
        }),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("المشروع غير موجود");
    return projectToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase().from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
