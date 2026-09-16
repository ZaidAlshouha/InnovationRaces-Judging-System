import type { CriterionRepository } from "@/lib/data/repositories";
import type {
  Criterion,
  CreateCriterionInput,
  UpdateCriterionInput,
} from "@/lib/domain/criterion";
import { supabase, criterionToDomain } from "./shared";

export class SupabaseCriterionRepository implements CriterionRepository {
  async listByHackathon(hackathonId: string): Promise<Criterion[]> {
    const { data, error } = await supabase()
      .from("criteria")
      .select("*")
      .eq("hackathon_id", hackathonId)
      .order("order", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(criterionToDomain);
  }

  async create(input: CreateCriterionInput): Promise<Criterion> {
    const { data, error } = await supabase()
      .from("criteria")
      .insert({
        hackathon_id: input.hackathonId,
        name: input.name,
        description: input.description ?? null,
        weight: input.weight,
        max_score: input.maxScore,
        order: input.order,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "تعذّر إنشاء المعيار");
    return criterionToDomain(data);
  }

  async update(input: UpdateCriterionInput): Promise<Criterion> {
    const { id, ...rest } = input;
    const { data, error } = await supabase()
      .from("criteria")
      .update({
        ...(rest.hackathonId !== undefined && { hackathon_id: rest.hackathonId }),
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.description !== undefined && {
          description: rest.description ?? null,
        }),
        ...(rest.weight !== undefined && { weight: rest.weight }),
        ...(rest.maxScore !== undefined && { max_score: rest.maxScore }),
        ...(rest.order !== undefined && { order: rest.order }),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("المعيار غير موجود");
    return criterionToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase().from("criteria").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
