import type { JudgeRepository } from "@/lib/data/repositories";
import type { Judge, CreateJudgeInput, UpdateJudgeInput } from "@/lib/domain/judge";
import { JudgeStatus } from "@/lib/domain/judge";
import { supabase, judgeToDomain } from "./shared";

export class SupabaseJudgeRepository implements JudgeRepository {
  async listByHackathon(hackathonId: string): Promise<Judge[]> {
    const { data, error } = await supabase()
      .from("judges")
      .select("*")
      .eq("hackathon_id", hackathonId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(judgeToDomain);
  }

  async getById(id: string): Promise<Judge | null> {
    const { data, error } = await supabase()
      .from("judges")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? judgeToDomain(data) : null;
  }

  async getByEmail(email: string): Promise<Judge | null> {
    const { data, error } = await supabase()
      .from("judges")
      .select("*")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? judgeToDomain(data) : null;
  }

  async create(input: CreateJudgeInput): Promise<Judge> {
    const { data, error } = await supabase()
      .from("judges")
      .insert({
        hackathon_id: input.hackathonId,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        notes: input.notes || null,
        status: input.status ?? JudgeStatus.Active,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "تعذّر إنشاء المحكّم");
    return judgeToDomain(data);
  }

  async update(input: UpdateJudgeInput): Promise<Judge> {
    const { id, ...rest } = input;
    const { data, error } = await supabase()
      .from("judges")
      .update({
        ...(rest.hackathonId !== undefined && { hackathon_id: rest.hackathonId }),
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.email !== undefined && { email: rest.email }),
        ...(rest.phone !== undefined && { phone: rest.phone || null }),
        ...(rest.notes !== undefined && { notes: rest.notes || null }),
        ...(rest.status !== undefined && { status: rest.status }),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("المحكّم غير موجود");
    return judgeToDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase().from("judges").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
