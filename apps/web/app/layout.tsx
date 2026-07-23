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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Skinest — AI Skin Analysis & Recommendations",
    template: "%s | Skinest",
  },
  description:
    "Get a personalised skincare routine powered by AI skin analysis. Dermatologist-approved recommendations from Nykaa, Minimalist, and Dermaco.",
  keywords: ["skin analysis", "skincare", "AI", "dermatologist", "India"],
  authors: [{ name: "Skinest Team" }],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Skinest",
    url: "/",
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

// Organization + WebSite structured data — deliberately NOT schema.org
// MedicalWebPage/MedicalOrganization. Those types assert clinical authority,
// which conflicts with this product's own disclaimer that it is not a
// substitute for professional medical advice; Organization/WebSite describes
// what this actually is without overclaiming.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Skinest",
      url: APP_URL,
      description:
        "AI-powered skin analysis and personalised skincare recommendations for Indian skin tones and climate.",
    },
    {
      "@type": "WebSite",
      name: "Skinest",
      url: APP_URL,
    },
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
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
