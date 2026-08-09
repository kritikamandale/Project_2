import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import { Toaster } from "@/components/shared/toaster";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5EFD9" },
    { media: "(prefers-color-scheme: dark)", color: "#5C6040" },
  ],
};

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
      <body className={`${cormorantGaramond.variable} ${manrope.variable} font-sans antialiased bg-[#F5EFD9] text-[#28261E]`}>
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
