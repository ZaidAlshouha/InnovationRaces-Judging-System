"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { useAssignment } from "@/lib/queries/use-assignments";
import { useProject } from "@/lib/queries/use-projects";
import { useCriteria } from "@/lib/queries/use-criteria";
import {
  useEvaluationByAssignment,
  useSubmitEvaluation,
} from "@/lib/queries/use-evaluations";
import { isEvaluationLocked } from "@/lib/scoring/engine";
import { AuditAction } from "@/lib/domain/audit-log";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/layout/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface ScoreFormValues {
  scores: { criterionId: string; score: number | ""; comment: string }[];
}

export default function EvaluateProjectPage() {
  const params = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const assignmentQuery = useAssignment(params.assignmentId);
  const assignment = assignmentQuery.data;

  const projectQuery = useProject(assignment?.projectId);
  const criteriaQuery = useCriteria(assignment?.hackathonId);
  const evaluationQuery = useEvaluationByAssignment(assignment?.id);
  const submitMutation = useSubmitEvaluation();
  const recordAudit = useRecordAuditAction();

  const criteria = React.useMemo(
    () => (criteriaQuery.data ?? []).slice().sort((a, b) => a.order - b.order),
    [criteriaQuery.data]
  );
  const evaluation = evaluationQuery.data;
  const isLocked = evaluation ? isEvaluationLocked(evaluation) : false;

  const form = useForm<ScoreFormValues>({
    defaultValues: { scores: [] },
  });

  React.useEffect(() => {
    if (criteria.length === 0) return;
    const scoresByCriterion = new Map(
      (evaluation?.scores ?? []).map((s) => [s.criterionId, s])
    );
    form.reset({
      scores: criteria.map((c) => ({
        criterionId: c.id,
        score: scoresByCriterion.get(c.id)?.score ?? "",
        comment: scoresByCriterion.get(c.id)?.comment ?? "",
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, evaluation?.id]);

  async function onSubmit(values: ScoreFormValues) {
    if (!assignment || !user?.judgeId) return;

    const missing = criteria.filter((c) => {
      const entry = values.scores.find((s) => s.criterionId === c.id);
      return entry === undefined || entry.score === "";
    });
    if (missing.length > 0) {
      toast.error("يجب تقييم جميع المعايير قبل الإرسال");
      return;
    }

    try {
      const evaluation = await submitMutation.mutateAsync({
        judgeId: user.judgeId,
        input: {
          assignmentId: assignment.id,
          scores: values.scores.map((s) => ({
            criterionId: s.criterionId,
            score: Number(s.score),
            comment: s.comment || undefined,
          })),
        },
      });
      await recordAudit.mutateAsync({
        hackathonId: evaluation.hackathonId,
        action: AuditAction.EvaluationSubmitted,
        entityType: "evaluation",
        entityId: evaluation.id,
        summary: `${user.name} أرسل تقييم مشروع ${projectQuery.data?.projectName ?? ""}`,
      });
      toast.success("تم إرسال التقييم بنجاح");
      router.push("/judge");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حدث خطأ أثناء إرسال التقييم"
      );
    }
  }

  const isLoading =
    assignmentQuery.isLoading ||
    projectQuery.isLoading ||
    criteriaQuery.isLoading ||
    evaluationQuery.isLoading;

  const isError =
    assignmentQuery.isError || projectQuery.isError || criteriaQuery.isError;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState description="تعذّر تحميل بيانات التقييم." />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState title="التوزيع غير موجود" />
      </div>
    );
  }

  if (user?.judgeId && assignment.judgeId !== user.judgeId) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState title="لا يمكنك الوصول إلى هذا التقييم" />
      </div>
    );
  }

  const project = projectQuery.data;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/judge"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4 rtl:rotate-180" />
        العودة إلى المشاريع المُسندة
      </Link>

      <PageHeader
        title={project?.projectName ?? "تقييم المشروع"}
        description={
          project ? `فريق ${project.teamName} — مشروع رقم ${project.projectNumber}` : undefined
        }
        actions={
          isLocked ? (
            <Badge variant="secondary">
              <Lock className="size-3" />
              تم الإرسال
            </Badge>
          ) : undefined
        }
      />

      {project?.description && (
        <Card className="mb-4">
          <CardContent className="space-y-3">
            <p className="text-sm leading-7 text-muted-foreground">
              {project.description}
            </p>
            {project.projectUrl && (
              <a
                href={project.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-4" />
                رابط المشروع
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {isLocked && (
        <p className="mb-4 text-sm text-muted-foreground">
          تم إرسال هذا التقييم ولا يمكن تعديله. تواصل مع المسؤول إذا كنت
          بحاجة إلى إعادة فتحه.
        </p>
      )}

      {criteria.length === 0 ? (
        <ErrorState
          title="لا توجد معايير تقييم"
          description="لم يقم المسؤول بتعريف معايير التقييم لهذا الهاكاثون بعد."
        />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {criteria.map((criterion, index) => (
              <Card key={criterion.id}>
                <CardHeader>
                  <CardTitle>{criterion.name}</CardTitle>
                  {criterion.description && (
                    <CardDescription>{criterion.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField
                    control={form.control}
                    name={`scores.${index}.score`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          الدرجة (من {criterion.maxScore})
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={criterion.maxScore}
                            step="0.5"
                            disabled={isLocked}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            className="w-32"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`scores.${index}.comment`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ملاحظات (اختياري)</FormLabel>
                        <FormControl>
                          <Textarea
                            disabled={isLocked}
                            placeholder="أي ملاحظات حول هذا المعيار"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            ))}

            {!isLocked && (
              <div className="flex justify-end">
                <Button type="submit" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? "جارٍ الإرسال..." : "إرسال التقييم"}
                </Button>
              </div>
            )}
          </form>
        </Form>
      )}
    </div>
  );
}
