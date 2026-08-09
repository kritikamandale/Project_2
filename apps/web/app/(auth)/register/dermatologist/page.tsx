"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SkinestLogo } from "@/components/shared/skinest-logo";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrength } from "@/components/auth/password-strength";
import { registerDermatologist } from "@/lib/api/auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z
  .object({
    full_name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/\d/, "Needs a number"),
    confirmPassword: z.string(),
    medical_license_number: z.string().min(5, "Enter your MCI / state council registration number"),
    specialization: z.string().optional(),
    hospital_name: z.string().min(2, "Enter your hospital or clinic name"),
    years_of_experience: z.coerce
      .number({ invalid_type_error: "Enter a number" })
      .int()
      .min(0)
      .max(60)
      .optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3;

const STEP_CONFIG: Record<Step, { title: string; subtitle: string }> = {
  1: { title: "Account credentials", subtitle: "Set up your login email and password" },
  2: { title: "Professional details", subtitle: "Provide your medical credentials for verification" },
  3: { title: "Review & submit", subtitle: "Your application goes to our admin team for approval" },
};

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? "w-6 bg-olive" : "w-2 bg-nude/40"
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DermatologistRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [serverError, setServerError] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
      medical_license_number: "",
      specialization: "",
      hospital_name: "",
      years_of_experience: undefined,
    },
    mode: "onTouched",
  });

  const watchedPassword = form.watch("password");

  async function validateAndAdvance(fields: (keyof FormValues)[]) {
    const ok = await form.trigger(fields);
    if (ok) setStep((s) => (Math.min(s + 1, 3) as Step));
  }

  function onSubmit(values: FormValues) {
    setServerError("");
    startTransition(async () => {
      try {
        await registerDermatologist({
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          medical_license_number: values.medical_license_number,
          hospital_name: values.hospital_name,
          specialization: values.specialization || undefined,
          years_of_experience: values.years_of_experience,
        });
        router.push(
          `/verify-email?email=${encodeURIComponent(values.email)}&derm=1`
        );
      } catch (err) {
        setServerError((err as Error).message ?? "Submission failed. Please try again.");
      }
    });
  }

  const { title, subtitle } = STEP_CONFIG[step];

  return (
    <AuthSplitLayout>
      <div className="w-full relative z-10">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center">
            <SkinestLogo href="/" size="md" />
          </div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-olive text-butter border border-deep-brown/10 mb-3 shadow-sm">
            <Stethoscope className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-deep-brown">
            Dermatologist Application
          </h1>
          <p className="text-xs font-sans uppercase tracking-widest text-deep-brown/70 mt-1">
            Join Skinest as a verified dermatologist reviewer
          </p>
        </div>

        <div className="bg-cream border border-deep-brown/15 rounded-xl p-6 sm:p-8 shadow-sm">
          <StepDots current={step} total={3} />
          <p className="text-xs text-center text-olive font-sans font-bold uppercase tracking-widest mb-1">
            Step {step} of 3
          </p>
          <h2 className="text-lg font-bold font-serif text-center text-deep-brown mb-1">
            {title}
          </h2>
          <p className="text-xs text-center text-deep-brown/70 mb-6 font-sans">{subtitle}</p>

          <AnimatePresence>
            {serverError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-4">
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* --- Step 1: Credentials --- */}
              {step === 1 && (
                <AnimatePresence mode="wait">
                  <motion.div key="s1" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name (as on medical licence)</FormLabel>
                        <FormControl><Input placeholder="Dr. Anjali Mehta" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Professional email</FormLabel>
                        <FormControl><Input type="email" placeholder="dr.anjali@hospital.in" autoComplete="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl><PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} /></FormControl>
                        <PasswordStrength password={watchedPassword} className="mt-2" />
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl><PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Button
                      type="button"
                      className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl py-3"
                      onClick={() => validateAndAdvance(["full_name", "email", "password", "confirmPassword"])}
                    >
                      Continue
                    </Button>
                    <p className="text-center text-xs text-deep-brown/80 font-sans">
                      Already have an account?{" "}
                      <Link href="/login" className="text-olive font-bold hover:underline">Sign in</Link>
                    </p>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* --- Step 2: Professional details --- */}
              {step === 2 && (
                <AnimatePresence mode="wait">
                  <motion.div key="s2" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
                    <FormField control={form.control} name="medical_license_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel>MCI / State Medical Council Registration No.</FormLabel>
                        <FormControl><Input placeholder="MH-12345" {...field} /></FormControl>
                        <FormDescription className="text-xs">
                          E.g. Maharashtra Medical Council, Delhi Medical Council, etc.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="specialization" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specialization (optional)</FormLabel>
                        <FormControl><Input placeholder="Dermatology, Cosmetology…" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="hospital_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hospital / Clinic name</FormLabel>
                        <FormControl><Input placeholder="Skin & Glow Clinic, Mumbai" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="years_of_experience" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of experience (optional)</FormLabel>
                        <FormControl><Input type="number" min={0} max={60} placeholder="8" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" className="flex-1 border-deep-brown/20 text-deep-brown hover:bg-nude/20 rounded-xl" onClick={() => setStep(1)}>Back</Button>
                      <Button
                        type="button"
                        className="flex-1 bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl"
                        onClick={() => validateAndAdvance(["medical_license_number", "hospital_name"])}
                      >
                        Continue
                      </Button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* --- Step 3: Review --- */}
              {step === 3 && (
                <AnimatePresence mode="wait">
                  <motion.div key="s3" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
                    {/* Summary */}
                    <div className="bg-nude/20 border border-deep-brown/10 rounded-xl p-4 space-y-2 text-xs">
                      {[
                        ["Name", form.getValues("full_name")],
                        ["Email", form.getValues("email")],
                        ["Licence No.", form.getValues("medical_license_number")],
                        ["Hospital", form.getValues("hospital_name")],
                        ["Specialization", form.getValues("specialization") || "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-deep-brown/60">{label}</span>
                          <span className="font-bold text-deep-brown">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* What happens next */}
                    <div className="bg-cream border border-deep-brown/15 rounded-xl p-4 text-xs space-y-1.5 text-deep-brown">
                      <p className="font-bold">What happens next?</p>
                      <p>1. Verify your email (code sent after submission)</p>
                      <p>2. Our admin team reviews your credentials (2–3 business days)</p>
                      <p>3. You receive an approval email to start reviewing cases</p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" className="flex-1 border-deep-brown/20 text-deep-brown hover:bg-nude/20 rounded-xl" onClick={() => setStep(2)}>Back</Button>
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="flex-1 bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl"
                      >
                        {isPending ? "Submitting…" : "Submit application"}
                      </Button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

            </form>
          </Form>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
