"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createJudgeInputSchema,
  updateJudgeInputSchema,
  JudgeStatus,
  JUDGE_STATUS_LABELS_AR,
  type Judge,
  type CreateJudgeInput,
} from "@/lib/domain/judge";
import { AuditAction } from "@/lib/domain/audit-log";
import { useCreateJudge, useUpdateJudge } from "@/lib/queries/use-judges";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";

interface JudgeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathonId: string;
  judge?: Judge;
}

/**
 * `status` carries a Zod `.default()`, which makes it optional in
 * `CreateJudgeInput`. The form always supplies it explicitly (see
 * `defaultValues` below), so it is narrowed back to required here to keep
 * `useForm`'s generic aligned with what the UI actually provides.
 */
type JudgeFormValues = Omit<CreateJudgeInput, "status"> & {
  status: Judge["status"];
};

export function JudgeFormDialog({
  open,
  onOpenChange,
  hackathonId,
  judge,
}: JudgeFormDialogProps) {
  const isEditing = Boolean(judge);
  const createMutation = useCreateJudge();
  const updateMutation = useUpdateJudge();
  const recordAudit = useRecordAuditAction();

  const defaultValues = React.useMemo<JudgeFormValues>(
    () => ({
      hackathonId,
      name: judge?.name ?? "",
      email: judge?.email ?? "",
      status: judge?.status ?? JudgeStatus.Active,
    }),
    [hackathonId, judge]
  );

  const form = useForm<JudgeFormValues>({
    // `createJudgeInputSchema` types `status` as optional (it has a Zod
    // `.default()`), but this form always supplies it explicitly — cast the
    // resolver to match the narrowed `JudgeFormValues` used here.
    resolver: zodResolver(createJudgeInputSchema) as unknown as Resolver<
      JudgeFormValues
    >,
    defaultValues,
  });

  React.useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  async function onSubmit(values: JudgeFormValues) {
    try {
      if (isEditing && judge) {
        const parsed = updateJudgeInputSchema.parse({ ...values, id: judge.id });
        const updated = await updateMutation.mutateAsync(parsed);
        await recordAudit.mutateAsync({
          hackathonId: updated.hackathonId,
          action: AuditAction.JudgeUpdated,
          entityType: "judge",
          entityId: updated.id,
          summary: `تم تعديل بيانات المحكّم ${updated.name}`,
        });
        toast.success("تم تحديث بيانات المحكّم بنجاح");
      } else {
        const created = await createMutation.mutateAsync(values);
        await recordAudit.mutateAsync({
          hackathonId: created.hackathonId,
          action: AuditAction.JudgeCreated,
          entityType: "judge",
          entityId: created.id,
          summary: `تمت إضافة المحكّم ${created.name}`,
        });
        toast.success("تمت إضافة المحكّم بنجاح");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حدث خطأ أثناء حفظ البيانات"
      );
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "تعديل بيانات المحكّم" : "إضافة محكّم جديد"}
          </DialogTitle>
          <DialogDescription>
            سيتمكن المحكّم من الدخول عبر بريده الإلكتروني لتقييم المشاريع
            المُسندة إليه فقط.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: أحمد المطيري" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      dir="ltr"
                      placeholder="name@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الحالة</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر الحالة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(JudgeStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          {JUDGE_STATUS_LABELS_AR[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
