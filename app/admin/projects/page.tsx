"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, FolderKanban, ExternalLink } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useProjects } from "@/lib/queries/use-projects";
import { useAssignments } from "@/lib/queries/use-assignments";
import { calculateProjectCompletionStats } from "@/lib/scoring/completion-stats";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectCompletionBadge } from "@/components/projects/project-completion-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortOption = "number-asc" | "name-asc" | "team-asc";

const SORT_LABELS: Record<SortOption, string> = {
  "number-asc": "ترتيب حسب رقم المشروع",
  "name-asc": "ترتيب حسب اسم المشروع",
  "team-asc": "ترتيب حسب اسم الفريق",
};

export default function ProjectsPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  const projectsQuery = useProjects(activeHackathon?.id);
  const assignmentsQuery = useAssignments(activeHackathon?.id);

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [sort, setSort] = React.useState<SortOption>("number-asc");
  const [createOpen, setCreateOpen] = React.useState(false);

  const projects = React.useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const completionStats = React.useMemo(
    () => calculateProjectCompletionStats(assignmentsQuery.data ?? []),
    [assignmentsQuery.data]
  );

  const categories = React.useMemo(() => {
    const set = new Set(projects.map((p) => p.category).filter(Boolean));
    return Array.from(set) as string[];
  }, [projects]);

  const filteredProjects = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = projects.filter((p) => {
      const matchesSearch =
        !query ||
        p.projectName.toLowerCase().includes(query) ||
        p.teamName.toLowerCase().includes(query) ||
        String(p.projectNumber).includes(query);
      const matchesCategory = category === "all" || p.category === category;
      return matchesSearch && matchesCategory;
    });

    result = [...result].sort((a, b) => {
      if (sort === "name-asc") return a.projectName.localeCompare(b.projectName, "ar");
      if (sort === "team-asc") return a.teamName.localeCompare(b.teamName, "ar");
      return a.projectNumber - b.projectNumber;
    });

    return result;
  }, [projects, search, category, sort]);

  const nextProjectNumber =
    projects.length > 0 ? Math.max(...projects.map((p) => p.projectNumber)) + 1 : 1;

  const isLoading = hackathonsQuery.isLoading || projectsQuery.isLoading;
  const isError = hackathonsQuery.isError || projectsQuery.isError;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="المشاريع"
        description="إدارة المشاريع المشاركة في الهاكاثون."
        actions={
          activeHackathon && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              مشروع جديد
            </Button>
          )
        }
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل قائمة المشاريع."
          onRetry={() => {
            hackathonsQuery.refetch();
            projectsQuery.refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !isError && !activeHackathon && (
        <EmptyState
          icon={FolderKanban}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا من صفحة الهاكاثونات لتتمكن من إضافة مشاريع."
        />
      )}

      {!isLoading && !isError && activeHackathon && (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الفريق أو رقم المشروع..."
                className="ps-8"
                aria-label="بحث في المشاريع"
              />
            </div>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v ?? "all")}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="كل الفئات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(v) => setSort((v as SortOption) ?? "number-asc")}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="لا توجد مشاريع مطابقة"
              description="جرّب تعديل البحث أو الفلاتر."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">الرقم</TableHead>
                    <TableHead>الفريق</TableHead>
                    <TableHead>المشروع</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>حالة التقييم</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium tabular-nums">
                        {project.projectNumber}
                      </TableCell>
                      <TableCell>{project.teamName}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/projects/${project.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {project.projectName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.category || "—"}
                      </TableCell>
                      <TableCell>
                        <ProjectCompletionBadge
                          stats={completionStats.get(project.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/projects/${project.id}`}
                          aria-label={`عرض تفاصيل ${project.projectName}`}
                        >
                          <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <ProjectFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            hackathonId={activeHackathon.id}
            nextProjectNumber={nextProjectNumber}
          />
        </>
      )}
    </div>
  );
}
