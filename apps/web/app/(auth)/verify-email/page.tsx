"use client";

import { Suspense, useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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
            <span className="font-heading font-bold text-xl text-skin-800">Skinest</span>
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-skin-400 to-skin-600 mb-3 shadow-lg">
            <span className="text-xl">📧</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Verify your email
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter the 6-digit code sent to{" "}
            <strong className="text-gray-700">{email || "your email"}</strong>
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
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
                        bg-skin-50 text-gray-900
                        ${digit ? "border-skin-500" : "border-skin-200"}
                        focus:border-skin-500 focus:ring-2 focus:ring-skin-200`}
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
                  className="w-full bg-skin-500 hover:bg-skin-600 text-white mb-4"
                >
                  {isPending ? "Verifying…" : "Verify"}
                </Button>

                {/* Resend */}
                <p className="text-center text-sm text-gray-500">
                  Didn&apos;t receive a code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-skin-600 hover:underline font-medium disabled:opacity-50"
                  >
                    {isResending ? "Sending…" : "Resend"}
                  </button>
                </p>
                <p className="text-center text-xs text-gray-400 mt-1">
                  Code expires in 10 minutes · Max 3 attempts
                </p>
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}
