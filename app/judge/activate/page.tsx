"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "@/lib/i18n/locale-context";

const activateSchema = z
  .object({
    password: z.string().min(6, "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل"),
    confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

type ActivateValues = z.infer<typeof activateSchema>;

/**
 * Where a judge lands after clicking their invitation email and the
 * server-side token exchange (app/auth/confirm/route.ts) has already
 * established a real Supabase Auth session for them via cookies — this
 * page's only job is to collect their chosen password and finalize the
 * account via supabase.auth.updateUser({ password }), matching the task's
 * explicit requirement "the admin should never create or know the judge's
 * password."
 *
 * Deliberately NOT nested under app/judge/layout.tsx (RequireRole) — a
 * judge who has only just verified their invite token has a real session
 * already (handle_new_auth_user(), 002_auth_linkage.sql, upserts
 * public.users with role='judge' the moment the Auth user is created), but
 * this page must work purely off that session without assuming
 * RequireRole's redirect timing, and must never render the judge portal
 * shell around a "set your password" form.
 *
 * If this page is reached without a valid session (e.g. an expired/reused
 * invite link, or someone navigating here directly), it shows a clear
 * error instead of a broken form — checked via getUser() on mount.
 */
export default function JudgeActivatePage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteError = searchParams.get("invite_error") === "1";

  const [sessionState, setSessionState] = React.useState<
    "checking" | "valid" | "invalid"
  >("checking");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().auth.getUser();
        if (!cancelled) setSessionState(!error && data.user ? "valid" : "invalid");
      } catch {
        if (!cancelled) setSessionState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<ActivateValues>({
    resolver: zodResolver(activateSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ActivateValues) {
    setIsSubmitting(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        password: values.password,
      });
      if (error) throw new Error(error.message);
      toast.success(t("judgeActivate.successToast"));
      router.replace("/judge");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("judgeActivate.genericError")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="mb-1 size-8 text-primary" aria-hidden="true" />
          <CardTitle>{t("judgeActivate.title")}</CardTitle>
          <CardDescription>{t("judgeActivate.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {inviteError && sessionState !== "valid" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{t("judgeActivate.linkExpiredError")}</AlertDescription>
            </Alert>
          )}

          {sessionState === "checking" && (
            <p className="text-center text-sm text-muted-foreground">
              {t("judgeActivate.checkingSession")}
            </p>
          )}

          {sessionState === "invalid" && !inviteError && (
            <Alert variant="destructive">
              <AlertDescription>{t("judgeActivate.noSessionError")}</AlertDescription>
            </Alert>
          )}

          {sessionState === "valid" && (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("judgeActivate.passwordLabel")}</FormLabel>
                      <FormControl>
                        <Input type="password" dir="ltr" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("judgeActivate.confirmPasswordLabel")}</FormLabel>
                      <FormControl>
                        <Input type="password" dir="ltr" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="mt-2">
                  {isSubmitting
                    ? t("judgeActivate.submittingButton")
                    : t("judgeActivate.submitButton")}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
