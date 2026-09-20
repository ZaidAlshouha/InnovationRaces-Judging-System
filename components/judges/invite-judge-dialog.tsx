"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
import { Send } from "lucide-react";
import {
  inviteJudgeInputSchema,
  InviteJudgeOutcome,
  type InviteJudgeInput,
} from "@/lib/domain/judge-invitation";
import { AuditAction } from "@/lib/domain/audit-log";
import { useInviteJudge } from "@/lib/queries/use-judges";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";
import { useTranslations } from "@/lib/i18n/locale-context";

interface InviteJudgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathonId: string;
}

/**
 * "إضافة محكّم" — the invitation flow's own dialog, deliberately separate
 * from JudgeFormDialog (which still handles plain edit of an existing
 * judge's name/phone/notes/status — see app/admin/judges/[judgeId]/page.tsx).
 * This dialog never collects a password (the task's explicit requirement):
 * submitting calls POST /api/admin/judges/invite
 * (via useInviteJudge(), lib/queries/use-judges.ts), which creates the
 * judges row AND invites the Supabase Auth account server-side.
 */
export function InviteJudgeDialog({
  open,
  onOpenChange,
  hackathonId,
}: InviteJudgeDialogProps) {
  const t = useTranslations();
  const inviteMutation = useInviteJudge();
  const recordAudit = useRecordAuditAction();

  const defaultValues = React.useMemo<InviteJudgeInput>(
    () => ({ hackathonId, name: "", email: "", phone: undefined, notes: undefined }),
    [hackathonId]
  );

  const form = useForm<InviteJudgeInput>({
    resolver: zodResolver(inviteJudgeInputSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  async function onSubmit(values: InviteJudgeInput) {
    try {
      const result = await inviteMutation.mutateAsync(values);

      await recordAudit.mutateAsync({
        hackathonId,
        action: AuditAction.JudgeInvited,
        entityType: "judge",
        entityId: result.judgeId,
        summary: `تمت دعوة المحكّم ${values.name} (${values.email})`,
      });

      switch (result.outcome) {
        case InviteJudgeOutcome.AlreadyAssigned:
          toast.info(t("judging.judgeAlreadyAssignedToast"));
          break;
        case InviteJudgeOutcome.LinkedToExistingAccount:
          toast.success(t("judging.judgeLinkedExistingAccountToast"));
          break;
        case InviteJudgeOutcome.Created:
          toast.success(
            result.invitationSent
              ? t("judging.judgeInvitedToast")
              : t("judging.judgeInviteEmailFailedToast")
          );
          break;
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("judging.genericInviteError")
      );
    }
  }

  const isSubmitting = inviteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("judging.inviteJudgeTitle")}</DialogTitle>
          <DialogDescription>{t("judging.inviteJudgeDescription")}</DialogDescription>
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
                <Send />
                {isSubmitting
                  ? t("judging.sendingInviteButton")
                  : t("judging.sendInviteButton")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
