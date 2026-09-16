import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Trophy,
  FolderKanban,
  Users,
  ListChecks,
  UsersRound,
  ClipboardCheck,
  BarChart3,
  FileText,
  History,
  Settings,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Single source of truth for the admin sidebar — order matches the spec exactly. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/admin/hackathons", label: "الهاكاثونات", icon: Trophy },
  { href: "/admin/projects", label: "المشاريع", icon: FolderKanban },
  { href: "/admin/judges", label: "المحكمون", icon: Users },
  { href: "/admin/criteria", label: "معايير التقييم", icon: ListChecks },
  { href: "/admin/assignments", label: "توزيع المحكمين", icon: UsersRound },
  { href: "/admin/monitoring", label: "متابعة التقييم", icon: ClipboardCheck },
  { href: "/admin/results", label: "النتائج والترتيب", icon: BarChart3 },
  { href: "/admin/reports", label: "التقارير", icon: FileText },
  { href: "/admin/audit-log", label: "سجل الأحداث", icon: History },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];
