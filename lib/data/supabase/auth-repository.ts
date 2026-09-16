import type { AuthRepository } from "@/lib/data/repositories";
import type { User } from "@/lib/domain/user";
import { supabase, buildDomainUser } from "./shared";

export class SupabaseAuthRepository implements AuthRepository {
  async signIn(email: string, password: string): Promise<User | null> {
    const { data, error } = await supabase().auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) return null;

    return buildDomainUser(data.user.id);
  }

  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user: authUser },
      error,
    } = await supabase().auth.getUser();

    if (error || !authUser) return null;
    return buildDomainUser(authUser.id);
  }

  async signOut(): Promise<void> {
    await supabase().auth.signOut();
  }
}
