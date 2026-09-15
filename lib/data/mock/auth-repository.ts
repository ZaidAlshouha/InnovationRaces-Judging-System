import type { AuthRepository } from "@/lib/data/repositories";
import type { User } from "@/lib/domain/user";
import { UserRole } from "@/lib/domain/user";
import { getMockStore, mockDelay } from "./store";

/**
 * PROTOTYPE-ONLY authentication.
 *
 * This is not real security: any password is accepted for the two demo
 * accounts below, and the "session" is a plain value in localStorage/cookie
 * managed by the auth context, not a signed token. It exists purely so the
 * admin/judge flows can be demoed end-to-end before Supabase Auth replaces
 * this file wholesale (see docs/supabase-schema.md).
 */
const DEMO_ADMIN: User = {
  id: "user-admin-demo",
  email: "admin@innovationraces.demo",
  name: "مسؤول InnovationRaces",
  role: UserRole.Admin,
};

const SESSION_STORAGE_KEY = "ir_demo_session_user_id";

function findJudgeUser(email: string): User | null {
  const judge = getMockStore().judges.find(
    (j) => j.email.toLowerCase() === email.toLowerCase()
  );
  if (!judge) return null;
  return {
    id: `user-${judge.id}`,
    email: judge.email,
    name: judge.name,
    role: UserRole.Judge,
    judgeId: judge.id,
  };
}

function resolveDemoUser(email: string): User | null {
  if (email.toLowerCase() === DEMO_ADMIN.email) return DEMO_ADMIN;
  // Any judge's real seeded email works, plus the literal demo alias from
  // the spec, which maps to the first seeded judge for demo purposes.
  if (email.toLowerCase() === "judge@innovationraces.demo") {
    const firstJudge = getMockStore().judges[0];
    return firstJudge ? findJudgeUser(firstJudge.email) : null;
  }
  return findJudgeUser(email);
}

export class MockAuthRepository implements AuthRepository {
  /**
   * `password` is intentionally unchecked — this is prototype-only auth.
   * Any non-empty password is accepted for a recognized demo/judge email.
   */
  async signIn(email: string, password: string): Promise<User | null> {
    void password;
    await mockDelay(300);
    const user = resolveDemoUser(email);
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, user.id);
      window.localStorage.setItem(
        `${SESSION_STORAGE_KEY}_data`,
        JSON.stringify(user)
      );
    }
    return user;
  }

  async getCurrentUser(): Promise<User | null> {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(`${SESSION_STORAGE_KEY}_data`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(`${SESSION_STORAGE_KEY}_data`);
  }
}
