"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SkinestLogo } from "@/components/shared/skinest-logo";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrength } from "@/components/auth/password-strength";
import { resetPassword } from "@/lib/api/auth";

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/\d/, "Needs a number"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

// useSearchParams() requires a Suspense boundary for static prerendering —
// the inner component reads params; the default export provides the boundary.
function ResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const watchedPassword = form.watch("new_password");

  function onSubmit(values: FormValues) {
    if (!token || !email) {
      setServerError("Invalid reset link. Please request a new one.");
      return;
    }
    setServerError("");
    startTransition(async () => {
      try {
        await resetPassword({ email, otp: token, new_password: values.new_password });
        setSuccess(true);
        setTimeout(() => router.push("/login?reset=1"), 2500);
      } catch (err) {
        setServerError((err as Error).message ?? "Reset failed. The link may have expired.");
      }
    });
  }

  return (
    <AuthSplitLayout>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full relative z-10"
      >
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center">
            <SkinestLogo href="/" size="md" />
          </div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-olive text-butter border border-deep-brown/10 mb-3 shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-deep-brown">
            Set New Password
          </h1>
          <p className="text-xs font-sans uppercase tracking-widest text-deep-brown/70 mt-1">
            Choose a strong password you haven&apos;t used before
          </p>
        </div>

        <div className="bg-cream border border-deep-brown/15 rounded-xl p-6 sm:p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-teal-700 text-lg">
                  Password updated!
                </h3>
                <p className="text-sm text-gray-500">
                  All active sessions have been signed out. Redirecting to login…
                </p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnimatePresence>
                  {serverError && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                      <Alert variant="destructive">
                        <AlertDescription>{serverError}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="new_password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} />
                        </FormControl>
                        <PasswordStrength password={watchedPassword} className="mt-2" />
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="confirm_password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm new password</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Button
                      type="submit"
                      disabled={isPending}
                      className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl py-3"
                    >
                      {isPending ? "Updating…" : "Update password"}
                    </Button>
                  </form>
                </Form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center mt-4 pt-4 border-t border-deep-brown/10">
            <Link href="/login" className="text-xs text-olive font-bold hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </AuthSplitLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}
