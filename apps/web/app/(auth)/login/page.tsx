"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { SkinestLogo } from "@/components/shared/skinest-logo";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Sparkles, Stethoscope } from "lucide-react";

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
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ---------------------------------------------------------------------------
// Role config
// ---------------------------------------------------------------------------

type Role = "user" | "dermatologist";

const ROLE_CONFIG: Record<
  Role,
  { label: string; Icon: React.ElementType; dashboardPath: string }
> = {
  user: {
    label: "User Sign In",
    Icon: Sparkles,
    dashboardPath: "/dashboard",
  },
  dermatologist: {
    label: "Dermatologist",
    Icon: Stethoscope,
    dashboardPath: "/derm-dashboard",
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

// useSearchParams() requires a Suspense boundary for static prerendering —
// the inner component reads params; the default export provides the boundary.
function LoginPageInner() {
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

      // Validate callbackUrl is a safe relative path to prevent open redirect.
      const safeCallback =
        callbackUrl && /^\/(?!\/)/.test(callbackUrl) ? callbackUrl : null;

      let dest = safeCallback ?? config.dashboardPath;

      // If user role has incomplete onboarding, route them directly into the 3-step pipeline
      if (activeRole === "user" && !safeCallback) {
        try {
          const res = await fetch("/api/proxy/onboarding/status");
          if (res.ok) {
            const data = await res.json();
            if (data.onboarding_status !== "completed" && data.next_path) {
              dest = data.next_path;
            }
          }
        } catch {
          /* Fallback to dashboard / middleware gate */
        }
      }

      router.push(dest);
      router.refresh();
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
        {/* Logo / brand */}
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center">
            <SkinestLogo href="/" size="md" />
          </div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-olive text-butter border border-deep-brown/10 mb-3 shadow-sm">
            <config.Icon className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-deep-brown">
            Welcome Back
          </h1>
          <p className="text-xs font-sans uppercase tracking-widest text-deep-brown/70 mt-1">
            AI-powered skincare for India
          </p>
        </div>

        {/* Card */}
        <div className="bg-cream border border-deep-brown/15 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Role tabs */}
          <Tabs
            value={activeRole}
            onValueChange={(v) => {
              setActiveRole(v as Role);
              setServerError("");
            }}
          >
            <TabsList className="grid grid-cols-2 w-full">
              {(Object.keys(ROLE_CONFIG) as Role[]).map((role) => {
                const RIcon = ROLE_CONFIG[role].Icon;
                return (
                  <TabsTrigger key={role} value={role} className="text-xs sm:text-sm flex items-center gap-1.5 justify-center">
                    <RIcon className="w-4 h-4" /> {ROLE_CONFIG[role].label}
                  </TabsTrigger>
                );
              })}
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
                        className="text-xs text-olive font-medium hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <PasswordInput
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
                className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl py-3"
              >
                {isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>

          {/* Footer links */}
          {activeRole === "user" && (
            <p className="text-center text-xs text-deep-brown/80 font-sans">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-olive font-bold hover:underline"
              >
                Create one
              </Link>
            </p>
          )}

          {activeRole === "dermatologist" && (
            <p className="text-center text-xs text-deep-brown/80 font-sans">
              Apply as a dermatologist?{" "}
              <Link
                href="/register/dermatologist"
                className="text-olive font-bold hover:underline"
              >
                Submit application
              </Link>
            </p>
          )}
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs text-deep-brown/60 mt-6 font-sans">
          By signing in, you agree to our{" "}
          <Link href="/privacy" className="underline text-deep-brown/80">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline text-deep-brown/80">
            Terms of Service
          </Link>
          .
        </p>
      </motion.div>
    </AuthSplitLayout>
  );

}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
