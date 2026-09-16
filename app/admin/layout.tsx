import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "@/components/layout/admin-header";
import { RequireRole } from "@/lib/auth/require-role";
import { UserRole } from "@/lib/domain/user";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole role={UserRole.Admin}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <main className="flex-1 overflow-x-hidden p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </RequireRole>
  );
}
