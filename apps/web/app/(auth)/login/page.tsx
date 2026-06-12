"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

// shadcn/ui primitives
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ---------------------------------------------------------------------------
// Role config
// ---------------------------------------------------------------------------

type Role = "user" | "dermatologist" | "admin";

const ROLE_CONFIG: Record<
  Role,
  { label: string; emoji: string; accent: string; dashboardPath: string }
> = {
  user: {
    label: "I'm a user",
    emoji: "✨",
    accent: "from-violet-500 to-indigo-500",
    dashboardPath: "/dashboard",
  },
  dermatologist: {
    label: "Dermatologist",
    emoji: "🩺",
    accent: "from-teal-500 to-cyan-500",
    dashboardPath: "/derm-dashboard",
  },
  admin: {
    label: "Admin",
    emoji: "🔑",
    accent: "from-rose-500 to-pink-500",
    dashboardPath: "/admin-dashboard",
  },
};

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type LoginValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

const USER_ERRORS: Record<string, string> = {
  CredentialsSignin: "Invalid credentials. Please try again.",
  SessionExpired: "Your session expired. Please log in again.",
  default: "Something went wrong. Please try again.",
};

function friendlyError(code: string | null): string {
  if (!code) return "";
  return USER_ERRORS[code] ?? USER_ERRORS.default;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const errorParam = searchParams.get("error");

  const [activeRole, setActiveRole] = useState<Role>("user");
  const [serverError, setServerError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const config = ROLE_CONFIG[activeRole];

  function onSubmit(values: LoginValues) {
    setServerError("");
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError(
          result.error === "CredentialsSignin"
            ? "Invalid credentials. Please try again."
            : result.error
        );
        return;
      }

      // Redirect to callbackUrl or role home
      const dest = callbackUrl ?? config.dashboardPath;
      router.push(dest);
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${config.accent} mb-4 shadow-lg transition-all duration-300`}
          >
            <span className="text-2xl">{config.emoji}</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 dark:text-white">
            Welcome to SkinAI
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-powered skincare for India
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 space-y-6">
          {/* Role tabs */}
          <Tabs
            value={activeRole}
            onValueChange={(v) => {
              setActiveRole(v as Role);
              setServerError("");
            }}
          >
            <TabsList className="grid grid-cols-3 w-full">
              {(Object.keys(ROLE_CONFIG) as Role[]).map((role) => (
                <TabsTrigger key={role} value={role} className="text-xs sm:text-sm">
                  {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Error alert */}
          <AnimatePresence>
            {(serverError || errorParam) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert variant="destructive">
                  <AlertDescription>
                    {serverError || friendlyError(errorParam)}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-violet-600 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isPending}
                className={`w-full bg-gradient-to-r ${config.accent} hover:opacity-90 text-white font-semibold`}
              >
                {isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>

          {/* Footer links */}
          {activeRole === "user" && (
            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-violet-600 font-medium hover:underline"
              >
                Create one
              </Link>
            </p>
          )}

          {activeRole === "dermatologist" && (
            <p className="text-center text-sm text-slate-500">
              Apply as a dermatologist?{" "}
              <Link
                href="/register/dermatologist"
                className="text-teal-600 font-medium hover:underline"
              >
                Submit application
              </Link>
            </p>
          )}
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in, you agree to our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          .
        </p>
      </motion.div>
    </div>
  );
}
