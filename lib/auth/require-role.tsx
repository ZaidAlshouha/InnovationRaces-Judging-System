"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { UserRole } from "@/lib/domain/user";

/** Full-screen redirect target when a session is present but has the wrong role. */
const ROLE_HOME: Record<UserRole, string> = {
  [UserRole.Admin]: "/admin/dashboard",
  [UserRole.Judge]: "/judge",
};

/**
 * Client-side route guard for the mock-auth phase. Renders nothing (and
 * redirects) until a session for the required role is confirmed. This is a
 * UX convenience only, matching the prototype-only auth in
 * `lib/data/mock/auth-repository.ts` — a real backend's RLS/session checks
 * are the actual security boundary once Supabase replaces this file.
 */
export function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== role) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [isLoading, user, role, router]);

  if (isLoading || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">جارٍ التحقق من الجلسة...</p>
      </div>
    );
  }

  return <>{children}</>;
}
