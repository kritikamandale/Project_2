import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope, Sora } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import { Toaster } from "@/components/shared/toaster";
import "./globals.css";

// Hero headings, subheadings, and large AI-score numbers (font-heading /
// font-display / font-number all resolve to this family — see tailwind.config.ts).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Body copy — the default reading text everywhere (paragraphs, descriptions,
// form labels, questionnaire copy, product card text).
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-manrope",
  display: "swap",
});

// Buttons — all CTAs, form submits, and nav actions app-wide.
const sora = Sora({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Skinest — AI Skin Analysis & Recommendations",
    template: "%s | Skinest",
  },
  description:
    "Get a personalised skincare routine powered by AI skin analysis. Dermatologist-approved recommendations from Nykaa, Minimalist, and Dermaco.",
  keywords: ["skin analysis", "skincare", "AI", "dermatologist", "India"],
  authors: [{ name: "Skinest Team" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Skinest",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1de" }, // eggshell
    { media: "(prefers-color-scheme: dark)", color: "#3d405b" },  // twilight-indigo
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${manrope.variable} ${sora.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
