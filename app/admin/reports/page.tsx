"use client";

import * as React from "react";
import { FileText, Download, Printer } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useResults } from "@/lib/queries/use-results";
import { useJudges } from "@/lib/queries/use-judges";
import { useAssignments } from "@/lib/queries/use-assignments";
import { calculateJudgeCompletionStats } from "@/lib/scoring/completion-stats";
import { toCsv, downloadCsv } from "@/lib/format/csv";
import type { ProjectResult } from "@/lib/domain/result";
import type { Judge } from "@/lib/domain/judge";
import type { EntityCompletionStats } from "@/lib/scoring/completion-stats";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RESULTS_COLUMNS = [
  { header: "الترتيب", accessor: (r: ProjectResult) => r.rank ?? "" },
  { header: "رقم المشروع", accessor: (r: ProjectResult) => r.projectNumber },
  { header: "المشروع", accessor: (r: ProjectResult) => r.projectName },
  { header: "الفريق", accessor: (r: ProjectResult) => r.teamName },
  {
    header: "التقييمات المكتملة",
    accessor: (r: ProjectResult) => `${r.completedEvaluations}/${r.requiredEvaluations}`,
  },
  { header: "النتيجة النهائية", accessor: (r: ProjectResult) => r.finalScore ?? "" },
];

interface JudgeCompletionRow {
  judge: Judge;
  stats: EntityCompletionStats | undefined;
}

const JUDGE_COLUMNS = [
  { header: "المحكّم", accessor: (r: JudgeCompletionRow) => r.judge.name },
  { header: "البريد الإلكتروني", accessor: (r: JudgeCompletionRow) => r.judge.email },
  {
    header: "التقييمات المكتملة",
    accessor: (r: JudgeCompletionRow) =>
      r.stats ? `${r.stats.completed}/${r.stats.required}` : "0/0",
  },
  {
    header: "نسبة الإنجاز",
    accessor: (r: JudgeCompletionRow) => `${r.stats?.percentage ?? 0}%`,
  },
];

export default function ReportsPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  const resultsQuery = useResults(activeHackathon?.id);
  const judgesQuery = useJudges(activeHackathon?.id);
  const assignmentsQuery = useAssignments(activeHackathon?.id);

  const results = resultsQuery.data ?? [];
  const judges = judgesQuery.data ?? [];
  const judgeStats = React.useMemo(
    () => calculateJudgeCompletionStats(assignmentsQuery.data ?? []),
    [assignmentsQuery.data]
  );

  const judgeRows: JudgeCompletionRow[] = judges.map((judge) => ({
    judge,
    stats: judgeStats.get(judge.id),
  }));

  const isLoading =
    hackathonsQuery.isLoading || resultsQuery.isLoading || judgesQuery.isLoading;
  const isError =
    hackathonsQuery.isError || resultsQuery.isError || judgesQuery.isError;

  function exportResultsCsv() {
    if (!activeHackathon) return;
    const csv = toCsv(RESULTS_COLUMNS, results);
    downloadCsv(`نتائج-${activeHackathon.name}.csv`, csv);
  }

  function exportJudgesCsv() {
    if (!activeHackathon) return;
    const csv = toCsv(JUDGE_COLUMNS, judgeRows);
    downloadCsv(`إنجاز-المحكمين-${activeHackathon.name}.csv`, csv);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="التقارير"
        description="تصدير النتائج وبيانات الإنجاز بصيغة CSV، أو طباعة النتائج مباشرة."
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل بيانات التقارير."
          onRetry={() => {
            hackathonsQuery.refetch();
            resultsQuery.refetch();
            judgesQuery.refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!isLoading && !isError && !activeHackathon && (
        <EmptyState
          icon={FileText}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا لتتمكن من تصدير التقارير."
        />
      )}

      {!isLoading && !isError && activeHackathon && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>تقرير النتائج والترتيب</CardTitle>
              <CardDescription>
                {results.length > 0
                  ? `يشمل ${results.length} مشروعًا مع الترتيب والنتيجة النهائية.`
                  : "لا توجد نتائج بعد."}
              </CardDescription>
            </CardHeader>
            <CardFooter className="gap-2">
              <Button
                variant="outline"
                disabled={results.length === 0}
                onClick={exportResultsCsv}
              >
                <Download />
                تصدير CSV
              </Button>
              <Button
                variant="outline"
                disabled={results.length === 0}
                render={<a href="/reports/print/results" target="_blank" rel="noopener noreferrer" />}
              >
                <Printer />
                عرض للطباعة
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>تقرير إنجاز المحكمين</CardTitle>
              <CardDescription>
                {judgeRows.length > 0
                  ? `يشمل ${judgeRows.length} محكّمًا مع نسبة إنجاز كل منهم.`
                  : "لا يوجد محكّمون بعد."}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                variant="outline"
                disabled={judgeRows.length === 0}
                onClick={exportJudgesCsv}
              >
                <Download />
                تصدير CSV
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
