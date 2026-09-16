"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { RequireRole } from "@/lib/auth/require-role";
import { UserRole } from "@/lib/domain/user";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";

export default function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole role={UserRole.Judge}>
      <JudgeShell>{children}</JudgeShell>
    </RequireRole>
  );
}

function JudgeShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          IR
        </div>
        <div className="flex flex-1 items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            بوابة المحكّم
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="تسجيل الخروج"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-x-hidden p-4 lg:p-6">{children}</main>
    </div>
  );
}
