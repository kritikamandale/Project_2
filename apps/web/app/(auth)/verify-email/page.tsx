"use client";

import { Suspense, useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SkinestLogo } from "@/components/shared/skinest-logo";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { verifyEmail, resendOtp } from "@/lib/api/auth";

const OTP_LENGTH = 6;

// useSearchParams() requires a Suspense boundary for static prerendering —
// the inner component reads params; the default export provides the boundary.
function VerifyEmailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const isDerm = searchParams.get("derm") === "1";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resent, setResent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResend] = useTransition();

  // Refs for each input for focus management
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-submit when all digits are filled
  useEffect(() => {
    const otp = digits.join("");
    if (otp.length === OTP_LENGTH && !isPending) {
      handleVerify(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  function handleChange(index: number, value: string) {
    // Accept only digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");

    // Move focus forward
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (pasted.length > 0) {
      const next = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setDigits(next);
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    }
  }

  function handleVerify(otp: string) {
    if (!email) {
      setError("Email address is missing. Please go back and try again.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await verifyEmail({ email, otp });
        setSuccess(true);
        // Redirect after a brief success display
        setTimeout(() => {
          router.push(isDerm ? "/login?verified=derm" : "/login?verified=1");
        }, 2000);
      } catch (err) {
        setError((err as Error).message ?? "Invalid or expired code. Please try again.");
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }
    });
  }

  function handleResend() {
    startResend(async () => {
      try {
        await resendOtp({ email });
        setResent(true);
        setError("");
        setTimeout(() => setResent(false), 5000);
      } catch {
        setError("Failed to resend. Please wait a moment and try again.");
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
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-deep-brown">
            Verify Your Email
          </h1>
          <p className="text-xs font-sans uppercase tracking-widest text-deep-brown/70 mt-1">
            Enter the 6-digit code sent to{" "}
            <strong className="text-deep-brown">{email || "your email"}</strong>
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
                  Email verified!
                </h3>
                <p className="text-sm text-gray-500">
                  {isDerm
                    ? "Your email is verified. Your account is now pending admin approval — you'll receive an email when activated."
                    : "Redirecting you to login…"}
                </p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* OTP digit inputs */}
                <div
                  className="flex gap-2 justify-center mb-6"
                  onPaste={handlePaste}
                >
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border outline-none transition-all
                        bg-cream text-deep-brown
                        ${digit ? "border-olive bg-butter/20" : "border-deep-brown/20"}
                        focus:border-olive focus:ring-1 focus:ring-olive/40`}
                      aria-label={`Digit ${i + 1}`}
                    />
                  ))}
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Resent notice */}
                <AnimatePresence>
                  {resent && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center text-sm text-teal-600 mb-3"
                    >
                      ✓ New code sent to {email}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Manual submit */}
                <Button
                  onClick={() => handleVerify(digits.join(""))}
                  disabled={isPending || digits.join("").length < OTP_LENGTH}
                  className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl py-3 mb-4"
                >
                  {isPending ? "Verifying…" : "Verify"}
                </Button>

                {/* Resend */}
                <p className="text-center text-xs text-deep-brown/80 font-sans">
                  Didn&apos;t receive a code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-olive hover:underline font-bold disabled:opacity-50"
                  >
                    {isResending ? "Sending…" : "Resend"}
                  </button>
                </p>
                <p className="text-center text-[11px] text-deep-brown/60 mt-1 font-sans">
                  Code expires in 10 minutes · Max 3 attempts
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}
