import type { HackathonRepository } from "@/lib/data/repositories";
import type {
  Hackathon,
  CreateHackathonInput,
  UpdateHackathonInput,
} from "@/lib/domain/hackathon";
import { supabase, hackathonToDomain } from "./shared";

export class SupabaseHackathonRepository implements HackathonRepository {
  async list(): Promise<Hackathon[]> {
    const { data, error } = await supabase()
      .from("hackathons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(hackathonToDomain);
  }

  async getById(id: string): Promise<Hackathon | null> {
    const { data, error } = await supabase()
      .from("hackathons")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? hackathonToDomain(data) : null;
  }

  async create(input: CreateHackathonInput): Promise<Hackathon> {
    const { data, error } = await supabase()
      .from("hackathons")
      .insert({
        name: input.name,
        description: input.description ?? null,
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "تعذّر إنشاء الهاكاثون");
    return hackathonToDomain(data);
  }

  async update(input: UpdateHackathonInput): Promise<Hackathon> {
    const { id, ...rest } = input;
    const { data, error } = await supabase()
      .from("hackathons")
      .update({
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.description !== undefined && {
          description: rest.description ?? null,
        }),
        ...(rest.startDate !== undefined && { start_date: rest.startDate }),
        ...(rest.endDate !== undefined && { end_date: rest.endDate }),
        ...(rest.status !== undefined && { status: rest.status }),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("الهاكاثون غير موجود");
    return hackathonToDomain(data);
  }
}
