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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  createJudgeInputSchema,
  updateJudgeInputSchema,
  JudgeStatus,
  type Judge,
  type CreateJudgeInput,
} from "@/lib/domain/judge";
import { AuditAction } from "@/lib/domain/audit-log";
import { useCreateJudge, useUpdateJudge } from "@/lib/queries/use-judges";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";
import { useTranslations } from "@/lib/i18n/locale-context";

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

/**
 * Plain judges-row editor — used ONLY for editing an existing judge's
 * name/phone/notes (see app/admin/judges/[judgeId]/page.tsx). Judge
 * *creation* now exclusively goes through InviteJudgeDialog
 * (components/judges/invite-judge-dialog.tsx), which also creates the
 * Supabase Auth account — this dialog's own create path is kept only for
 * the rare case a judges row somehow has no create call site left (mock
 * fixtures/tests), but is not reachable from any admin UI screen anymore.
 *
 * Email is READ-ONLY once a judge exists (isEditing) — deliberately: this
 * app's Auth linkage (judges.email <-> auth.users.email, see
 * 002_auth_linkage.sql's handle_new_auth_user()/
 * link_judge_to_existing_auth_user() triggers) only ever matches by email
 * at INSERT/signup time, never re-syncs on a later edit. Changing
 * judges.email here alone would silently desync it from the judge's real
 * Auth identity — exactly the "unsafe client-side Auth identity change"
 * the task explicitly prohibits. There is no secure server-side email-change
 * flow implemented in this phase, so the field is simply locked; a future
 * phase could add one following the same requireAdminFromRequest() +
 * service_role pattern as the invite route.
 *
 * `status` is intentionally NOT editable here — disable/enable goes
 * through its own dedicated confirm-dialog flow on the judges list page
 * (app/admin/judges/page.tsx), which also produces its own, more specific
 * audit action (judge_disabled/judge_enabled vs the generic judge_updated
 * this dialog still records for name/phone/notes edits).
 */
export function JudgeFormDialog({
  open,
  onOpenChange,
  hackathonId,
  judge,
}: JudgeFormDialogProps) {
  const t = useTranslations();
  const isEditing = Boolean(judge);
  const createMutation = useCreateJudge();
  const updateMutation = useUpdateJudge();
  const recordAudit = useRecordAuditAction();

  const defaultValues = React.useMemo<JudgeFormValues>(
    () => ({
      hackathonId,
      name: judge?.name ?? "",
      email: judge?.email ?? "",
      phone: judge?.phone,
      notes: judge?.notes,
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
        const parsed = updateJudgeInputSchema.parse({
          id: judge.id,
          name: values.name,
          phone: values.phone,
          notes: values.notes,
        });
        const updated = await updateMutation.mutateAsync(parsed);
        await recordAudit.mutateAsync({
          hackathonId: updated.hackathonId,
          action: AuditAction.JudgeUpdated,
          entityType: "judge",
          entityId: updated.id,
          summary: `تم تعديل بيانات المحكّم ${updated.name}`,
        });
        toast.success(t("judging.judgeUpdatedToast"));
      } else {
        const created = await createMutation.mutateAsync(values);
        await recordAudit.mutateAsync({
          hackathonId: created.hackathonId,
          action: AuditAction.JudgeCreated,
          entityType: "judge",
          entityId: created.id,
          summary: `تمت إضافة المحكّم ${created.name}`,
        });
        toast.success(t("judging.judgeCreatedToast"));
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("judging.genericSaveError")
      );
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("judging.editJudgeTitle") : t("judging.addJudgeTitle")}
          </DialogTitle>
          <DialogDescription>{t("judging.judgeFormDescription")}</DialogDescription>
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
                  <FormLabel>{t("judging.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("judging.namePlaceholder")} {...field} />
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
                  <FormLabel>{t("judging.columnEmail")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      dir="ltr"
                      placeholder={t("judging.emailPlaceholder")}
                      disabled={isEditing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("judging.phoneOptionalLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      dir="ltr"
                      placeholder={t("judging.phonePlaceholder")}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("judging.notesLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("judging.notesPlaceholder")}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
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
                {t("judging.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("judging.saving") : t("judging.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
