"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

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

export default function ResetPasswordPage() {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-skin-50 via-white to-skin-100/40 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <span className="font-heading font-bold text-xl text-skin-800">SkinAI</span>
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-skin-400 to-skin-600 mb-3 shadow-lg">
            <span className="text-xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Set a new password
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Choose a strong password you haven&apos;t used before
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-skin-100 p-8">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-3"
              >
                <div className="text-5xl">✅</div>
                <h3 className="font-semibold text-green-700 text-lg">
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
                      className="w-full bg-skin-500 hover:bg-skin-600 text-white"
                    >
                      {isPending ? "Updating…" : "Update password"}
                    </Button>
                  </form>
                </Form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center mt-4 pt-4 border-t border-skin-100">
            <Link href="/login" className="text-sm text-skin-600 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
