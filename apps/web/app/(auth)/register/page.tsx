"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordStrength } from "@/components/auth/password-strength";
import { registerUser } from "@/lib/api/auth";

// ---------------------------------------------------------------------------
// Fitzpatrick scale — visual skin tone selector
// ---------------------------------------------------------------------------

const FITZPATRICK = [
  { value: "I",   label: "Type I",   bg: "#FDDBB4", desc: "Very fair" },
  { value: "II",  label: "Type II",  bg: "#F5C28A", desc: "Fair" },
  { value: "III", label: "Type III", bg: "#E0A96D", desc: "Medium" },
  { value: "IV",  label: "Type IV",  bg: "#C68642", desc: "Olive" },
  { value: "V",   label: "Type V",   bg: "#8D5524", desc: "Brown" },
  { value: "VI",  label: "Type VI",  bg: "#4A2912", desc: "Deep" },
] as const;

type FitzpatrickValue = (typeof FITZPATRICK)[number]["value"];

// ---------------------------------------------------------------------------
// Schemas per step
// ---------------------------------------------------------------------------

const step1Schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/\d/, "Needs a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const step2Schema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  city: z.string().min(2, "Enter your city"),
  state: z.string().min(2, "Enter your state"),
});

const step3Schema = z.object({
  skin_tone: z.string().optional(),
});

const step4Schema = z.object({
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must accept the privacy policy" }),
  }),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;
type Step4 = z.infer<typeof step4Schema>;

// ---------------------------------------------------------------------------
// Step header component
// ---------------------------------------------------------------------------

function StepHeader({
  step,
  total,
  title,
  subtitle,
}: {
  step: number;
  total: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2 mb-6">
      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center mb-4">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i < step ? "w-6 bg-violet-500" : i === step - 1 ? "w-6 bg-violet-500" : "w-2 bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-center text-slate-400 uppercase tracking-wide">
        Step {step} of {total}
      </p>
      <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="text-sm text-center text-slate-500">{subtitle}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [serverError, setServerError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Accumulated data across steps
  const [stepData, setStepData] = useState<Partial<Step1 & Step2 & Step3>>({});

  // ---------- Step 1 ----------
  const form1 = useForm<Step1>({
    resolver: zodResolver(step1Schema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });
  const watchedPassword = form1.watch("password");

  // ---------- Step 2 ----------
  const form2 = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    defaultValues: { full_name: "", city: "", state: "" },
  });

  // ---------- Step 3 ----------
  const [selectedTone, setSelectedTone] = useState<FitzpatrickValue | "">("");

  // ---------- Step 4 ----------
  const form4 = useForm<Step4>({
    resolver: zodResolver(step4Schema),
    defaultValues: { consent: undefined as any },
  });

  // ---------- Navigation ----------
  function goNext() {
    setCurrentStep((s) => s + 1);
    setServerError("");
  }

  function goPrev() {
    setCurrentStep((s) => s - 1);
    setServerError("");
  }

  function onStep1(values: Step1) {
    setStepData((d) => ({ ...d, ...values }));
    goNext();
  }

  function onStep2(values: Step2) {
    setStepData((d) => ({ ...d, ...values }));
    goNext();
  }

  function onStep3() {
    setStepData((d) => ({ ...d, skin_tone: selectedTone || undefined }));
    goNext();
  }

  function onStep4() {
    setServerError("");
    startTransition(async () => {
      try {
        await registerUser({
          email: stepData.email!,
          password: stepData.password!,
          full_name: stepData.full_name!,
        });
        // Redirect to email verification with the email pre-filled
        router.push(`/verify-email?email=${encodeURIComponent(stepData.email!)}`);
      } catch (err) {
        setServerError((err as Error).message ?? "Registration failed. Please try again.");
      }
    });
  }

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 mb-3 shadow-lg">
            <span className="text-xl">✨</span>
          </div>
          <h1 className="text-xl font-bold font-heading text-slate-900 dark:text-white">
            Create your SkinAI account
          </h1>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8">
          <AnimatePresence mode="wait">

            {/* ---- STEP 1: Email + Password ---- */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <StepHeader
                  step={1} total={4}
                  title="Create your account"
                  subtitle="Start with your email and a strong password"
                />
                <Form {...form1}>
                  <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
                    <FormField control={form1.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form1.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                        </FormControl>
                        <PasswordStrength password={watchedPassword} className="mt-2" />
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form1.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Button type="submit" className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white">
                      Continue
                    </Button>
                  </form>
                </Form>

                <p className="text-center text-sm text-slate-500 mt-4">
                  Already have an account?{" "}
                  <Link href="/login" className="text-violet-600 font-medium hover:underline">Sign in</Link>
                </p>
              </motion.div>
            )}

            {/* ---- STEP 2: Profile + City ---- */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <StepHeader
                  step={2} total={4}
                  title="Your basic profile"
                  subtitle="We use your city to tailor recommendations for local climate"
                />
                <Form {...form2}>
                  <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
                    <FormField control={form2.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Priya Sharma" autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form2.control} name="city" render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Mumbai" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="state" render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="Maharashtra" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={goPrev}>Back</Button>
                      <Button type="submit" className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 text-white">Continue</Button>
                    </div>
                  </form>
                </Form>
              </motion.div>
            )}

            {/* ---- STEP 3: Fitzpatrick skin tone ---- */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <StepHeader
                  step={3} total={4}
                  title="Your skin tone"
                  subtitle="Select the closest match to your natural skin tone (optional)"
                />

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {FITZPATRICK.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setSelectedTone(f.value)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                        selectedTone === f.value
                          ? "border-violet-500 shadow-md scale-105"
                          : "border-transparent hover:border-slate-200"
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-full mb-2 shadow-inner"
                        style={{ backgroundColor: f.bg }}
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{f.label}</span>
                      <span className="text-xs text-slate-400">{f.desc}</span>
                    </button>
                  ))}
                </div>

                <p className="text-xs text-slate-400 text-center mb-4">
                  This helps us fine-tune sunscreen SPF and ingredient recommendations.
                </p>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={goPrev}>Back</Button>
                  <Button type="button" className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 text-white" onClick={onStep3}>
                    {selectedTone ? "Continue" : "Skip for now"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ---- STEP 4: Consent ---- */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <StepHeader
                  step={4} total={4}
                  title="Privacy & consent"
                  subtitle="Your skin images are processed ephemerally and never stored"
                />

                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6">
                  <p>🔒 <strong>Image privacy:</strong> Camera images are analysed on-device first. If server analysis is needed, images are uploaded via a 60-second presigned URL and permanently deleted after analysis.</p>
                  <p>🩺 <strong>Dermatologist review:</strong> Anonymised skin analysis data may be reviewed by verified dermatologists to improve recommendations.</p>
                  <p>📍 <strong>Location data:</strong> Your city is used only for climate-based product recommendations and is never sold to third parties.</p>
                </div>

                <AnimatePresence>
                  {serverError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{serverError}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Form {...form4}>
                  <form onSubmit={form4.handleSubmit(onStep4)} className="space-y-4">
                    <FormField
                      control={form4.control}
                      name="consent"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="text-sm leading-tight">
                            <FormLabel className="font-normal cursor-pointer">
                              I have read and agree to the{" "}
                              <Link href="/privacy" className="text-violet-600 hover:underline" target="_blank">Privacy Policy</Link>{" "}
                              and{" "}
                              <Link href="/terms" className="text-violet-600 hover:underline" target="_blank">Terms of Service</Link>.
                              I consent to the use of my skin data as described above.
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={goPrev}>Back</Button>
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
                      >
                        {isPending ? "Creating account…" : "Create account"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
