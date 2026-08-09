"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sparkles, ChevronRight, Bell, Settings } from "lucide-react";

const PAGE_HEADERS: Record<string, { title: string; subtitle: string; category: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overview of your skin health & daily routine",
    category: "Skinest",
  },
  "/onboarding/questionnaire": {
    title: "Lifestyle Questionnaire",
    subtitle: "Help us understand your environment & habits",
    category: "Analysis",
  },
  "/questionnaire": {
    title: "Lifestyle Questionnaire",
    subtitle: "Help us understand your environment & habits",
    category: "Analysis",
  },
  "/scan": {
    title: "AI Face Scan",
    subtitle: "Real-time AI diagnostic scan of your skin conditions",
    category: "Analysis",
  },
  "/onboarding/scan": {
    title: "AI Face Scan",
    subtitle: "Real-time AI diagnostic scan of your skin conditions",
    category: "Analysis",
  },
  "/onboarding/recommendations": {
    title: "Building Recommendations",
    subtitle: "AI engine generating your custom 20-week plan",
    category: "Recommendations",
  },
  "/results": {
    title: "Personalised Recommendations",
    subtitle: "Tailored products & routine for your skin & climate",
    category: "Recommendations",
  },
  "/roadmap": {
    title: "20-Week Skincare Roadmap",
    subtitle: "Phased treatment plan for optimal skin transformation",
    category: "Plan",
  },
  "/progress": {
    title: "Progress Tracker",
    subtitle: "Track improvement metrics over time",
    category: "Analytics",
  },
  "/history": {
    title: "Scan History",
    subtitle: "Review your past face scans and skin scores",
    category: "History",
  },
  "/profile": {
    title: "My Profile",
    subtitle: "Manage your skin profile & preferences",
    category: "Account",
  },
};

export function AppHeader() {
  const pathname = usePathname() || "";
  const { data: session } = useSession();

  let header = PAGE_HEADERS[pathname];
  if (!header) {
    if (pathname.startsWith("/results/")) {
      header = {
        title: "Personalised Recommendations",
        subtitle: "Dermatologist-formulated routine for your skin & climate",
        category: "Recommendations",
      };
    } else if (pathname.startsWith("/history/")) {
      header = {
        title: "Scan Detail",
        subtitle: "In-depth diagnostic analysis",
        category: "History",
      };
    } else {
      header = {
        title: "Skin Analysis Platform",
        subtitle: "Dermatology-grade skincare intelligence",
        category: "Skinest",
      };
    }
  }

  const name = session?.user?.name ?? "User";
  const initial = name.trim()[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-deep-brown/15 bg-cream/95 px-6 backdrop-blur-md font-sans text-deep-brown">
      {/* Page Title & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden sm:flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-widest text-olive shrink-0">
          <span>{header.category}</span>
          <ChevronRight className="w-3.5 h-3.5 text-deep-brown/40" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold font-serif text-deep-brown truncate leading-tight">
            {header.title}
          </h1>
          <p className="text-xs font-sans text-deep-brown/70 truncate hidden sm:block">
            {header.subtitle}
          </p>
        </div>
      </div>

      {/* Right User Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Quick status badge */}
        <div className="hidden md:flex items-center gap-1.5 bg-butter/40 border border-deep-brown/10 text-deep-brown rounded-full px-3 py-1 text-xs font-sans font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-olive" />
          <span>AI Engine Active</span>
        </div>

        {/* User Avatar Pill */}
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-full border border-deep-brown/15 bg-cream p-1 pr-3 shadow-xs hover:border-olive transition-all"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-butter text-xs font-sans font-bold text-deep-brown border border-deep-brown/10 shadow-xs">
            {initial}
          </div>
          <span className="text-xs font-sans font-bold uppercase tracking-wider text-deep-brown hidden sm:inline truncate max-w-[100px]">
            {name}
          </span>
        </Link>
      </div>
    </header>
  );
}
