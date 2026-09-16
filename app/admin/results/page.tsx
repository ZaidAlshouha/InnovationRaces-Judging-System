"use client";

import * as React from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useResults } from "@/lib/queries/use-results";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";

export default function ResultsPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];
  const resultsQuery = useResults(activeHackathon?.id);

  const [expandedProjectId, setExpandedProjectId] = React.useState<string | null>(null);

  const results = resultsQuery.data ?? [];

  const isLoading = hackathonsQuery.isLoading || resultsQuery.isLoading;
  const isError = hackathonsQuery.isError || resultsQuery.isError;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="النتائج والترتيب"
        description="الترتيب النهائي محسوب فقط من المشاريع المكتملة التقييم."
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل النتائج."
          onRetry={() => {
            hackathonsQuery.refetch();
            resultsQuery.refetch();
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
          icon={BarChart3}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا لعرض النتائج."
        />
      )}

      {!isLoading && !isError && activeHackathon && results.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title="لا توجد نتائج بعد"
          description="أضف مشاريع ومحكمين وابدأ التقييم لعرض النتائج هنا."
        />
      )}

      {!isLoading && !isError && activeHackathon && results.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">الترتيب</TableHead>
                <TableHead className="w-16">الرقم</TableHead>
                <TableHead>المشروع</TableHead>
                <TableHead>الفريق</TableHead>
                <TableHead>حالة التقييم</TableHead>
                <TableHead className="text-end">النتيجة النهائية</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => {
                const isExpanded = expandedProjectId === result.projectId;
                return (
                  <React.Fragment key={result.projectId}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedProjectId(isExpanded ? null : result.projectId)
                      }
                    >
                      <TableCell className="tabular-nums">
                        {result.rank ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {result.projectNumber}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {result.projectName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.teamName}
                      </TableCell>
                      <TableCell>
                        {result.isComplete ? (
                          <Badge variant="default">مكتمل</Badge>
                        ) : (
                          <Badge variant="secondary">
                            {result.completedEvaluations} / {result.requiredEvaluations} مكتمل
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end tabular-nums font-medium">
                        {result.finalScore !== null ? result.finalScore : "—"}
                      </TableCell>
                      <TableCell>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="space-y-3 p-4">
                            {result.judgeScores.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                لا توجد تقييمات مُرسلة بعد لهذا المشروع.
                              </p>
                            ) : (
                              result.judgeScores.map((judgeScore) => (
                                <div
                                  key={judgeScore.judgeId}
                                  className="rounded-md border border-border bg-card p-3"
                                >
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground">
                                      {judgeScore.judgeName}
                                    </span>
                                    <span className="text-sm tabular-nums text-muted-foreground">
                                      المجموع المرجّح: {judgeScore.weightedTotal}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                    {judgeScore.criterionScores.map((cs) => (
                                      <div
                                        key={cs.criterionId}
                                        className={cn(
                                          "flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
                                        )}
                                      >
                                        <span className="text-muted-foreground">
                                          {cs.criterionName}
                                        </span>
                                        <span className="tabular-nums text-foreground">
                                          {cs.rawScore} ({cs.weightedScore})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
