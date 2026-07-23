import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Sign up for Skinest and get a personalised, AI-powered skincare routine in minutes.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
