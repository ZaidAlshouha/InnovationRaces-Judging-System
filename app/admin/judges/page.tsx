"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useJudges } from "@/lib/queries/use-judges";
import { useAssignments } from "@/lib/queries/use-assignments";
import { calculateJudgeCompletionStats } from "@/lib/scoring/completion-stats";
import { JudgeStatus } from "@/lib/domain/judge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { JudgeFormDialog } from "@/components/judges/judge-form-dialog";
import { JudgeStatusBadge } from "@/components/judges/judge-status-badge";
import { JudgeProgress } from "@/components/judges/judge-progress";
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

type StatusFilter = "all" | typeof JudgeStatus.Active | typeof JudgeStatus.Inactive;

export default function JudgesPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  const judgesQuery = useJudges(activeHackathon?.id);
  const assignmentsQuery = useAssignments(activeHackathon?.id);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  const judges = React.useMemo(() => judgesQuery.data ?? [], [judgesQuery.data]);
  const completionStats = React.useMemo(
    () => calculateJudgeCompletionStats(assignmentsQuery.data ?? []),
    [assignmentsQuery.data]
  );

  const filteredJudges = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return judges
      .filter((j) => {
        const matchesSearch =
          !query ||
          j.name.toLowerCase().includes(query) ||
          j.email.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || j.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [judges, search, statusFilter]);

  const isLoading = hackathonsQuery.isLoading || judgesQuery.isLoading;
  const isError = hackathonsQuery.isError || judgesQuery.isError;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="المحكمون"
        description="إدارة المحكمين ومتابعة تقدّمهم في التقييم."
        actions={
          activeHackathon && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              محكّم جديد
            </Button>
          )
        }
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل قائمة المحكمين."
          onRetry={() => {
            hackathonsQuery.refetch();
            judgesQuery.refetch();
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
          icon={Users}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا لتتمكن من إضافة محكمين."
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
                placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                className="ps-8"
                aria-label="بحث في المحكمين"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter((v as StatusFilter) ?? "all")}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value={JudgeStatus.Active}>نشط</SelectItem>
                <SelectItem value={JudgeStatus.Inactive}>غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredJudges.length === 0 ? (
            <EmptyState
              icon={Users}
              title="لا يوجد محكّمون مطابقون"
              description="جرّب تعديل البحث أو الفلاتر."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التقدّم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJudges.map((judge) => (
                    <TableRow key={judge.id}>
                      <TableCell>
                        <Link
                          href={`/admin/judges/${judge.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {judge.name}
                        </Link>
                      </TableCell>
                      <TableCell dir="ltr" className="text-start text-muted-foreground">
                        {judge.email}
                      </TableCell>
                      <TableCell>
                        <JudgeStatusBadge status={judge.status} />
                      </TableCell>
                      <TableCell>
                        <JudgeProgress stats={completionStats.get(judge.id)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <JudgeFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            hackathonId={activeHackathon.id}
          />
        </>
      )}
    </div>
  );
}
