"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SkinestLogo } from "@/components/shared/skinest-logo";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { LockKeyhole, MailCheck } from "lucide-react";

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
import { forgotPassword } from "@/lib/api/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      await forgotPassword({ email: values.email }).catch(() => {});
      // Always show success — never reveal whether email exists
      setSubmitted(true);
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
            <LockKeyhole className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-deep-brown">
            Forgot Your Password?
          </h1>
          <p className="text-xs font-sans uppercase tracking-widest text-deep-brown/70 mt-1">
            Enter your email to receive a reset link
          </p>
        </div>

        <div className="bg-cream border border-deep-brown/15 rounded-xl p-6 sm:p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Button
                      type="submit"
                      disabled={isPending}
                      className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl py-3"
                    >
                      {isPending ? "Sending…" : "Send reset link"}
                    </Button>
                  </form>
                </Form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-butter/40 text-deep-brown flex items-center justify-center mx-auto mb-2 border border-deep-brown/10">
                  <MailCheck className="w-6 h-6 text-olive" />
                </div>
                <h3 className="font-serif font-bold text-deep-brown text-xl">
                  Check your inbox
                </h3>
                <p className="text-xs text-deep-brown/80 font-sans">
                  If an account exists for{" "}
                  <strong>{form.getValues("email")}</strong>, a password reset
                  link has been sent. It expires in{" "}
                  <strong>15 minutes</strong>.
                </p>
                <p className="text-xs text-deep-brown/60 font-sans">
                  Didn&apos;t receive it? Check your spam folder or{" "}
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="text-olive font-bold hover:underline"
                  >
                    try again
                  </button>
                  .
                </p>
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
