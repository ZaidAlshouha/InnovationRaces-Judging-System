"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminSidebarBrand, AdminSidebarNav } from "./admin-sidebar";
import { useAuth } from "@/lib/auth/auth-context";

export function AdminHeader() {
  const [open, setOpen] = React.useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="فتح القائمة"
            />
          }
        >
          <Menu className="size-5" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="right" className="w-72 bg-sidebar p-0">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">القائمة الرئيسية</SheetTitle>
            <AdminSidebarBrand />
          </SheetHeader>
          <AdminSidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 items-center justify-between">
        <p className="text-sm font-medium text-foreground lg:hidden">
          InnovationRaces
        </p>
        <div className="ms-auto flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-medium text-foreground">
              {user?.name ?? "مسؤول InnovationRaces"}
            </span>
            <span className="text-xs text-muted-foreground">
              {user?.email ?? ""}
            </span>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            {user?.name?.charAt(0) ?? "م"}
          </div>
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
  );
}
