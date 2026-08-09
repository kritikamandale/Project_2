"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Camera,
  TrendingUp,
  Map,
  History,
  BarChart3,
  User,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
} from "lucide-react";
import { SkinestLogo } from "@/components/shared/skinest-logo";

type Area = "user" | "derm";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV: Record<Area, NavItem[]> = {
  user: [
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/questionnaire", label: "Questionnaire", Icon: ClipboardCheck },
    { href: "/scan", label: "Face Scan", Icon: Camera },
    { href: "/results", label: "Recommendations", Icon: BarChart3 },
    { href: "/roadmap", label: "Skincare Roadmap", Icon: Map },
    { href: "/progress", label: "Progress Tracker", Icon: TrendingUp },
    { href: "/history", label: "Scan History", Icon: History },
    { href: "/profile", label: "My Profile", Icon: User },
  ],
  derm: [
    { href: "/derm-dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/review-queue", label: "Review Queue", Icon: ClipboardCheck },
  ],
};

const HOME: Record<Area, string> = { user: "/dashboard", derm: "/derm-dashboard" };

export function AppSidebar({ area }: { area: Area }) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const items = NAV[area];
  const name = session?.user?.name ?? "Account";
  const email = session?.user?.email ?? "";
  const initial = name.trim()[0]?.toUpperCase() ?? "U";

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    if (href === "/scan" && pathname === "/onboarding/scan") return true;
    if (href === "/results" && (pathname === "/onboarding/recommendations" || pathname.startsWith("/results"))) return true;
    if (href === "/onboarding/questionnaire" && (pathname === "/questionnaire" || pathname === "/onboarding")) return true;
    return false;
  };

  const content = (
    <div className="flex h-full flex-col bg-olive text-cream font-sans">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-cream/15 px-5">
        <SkinestLogo href={HOME[area]} size="md" />
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all duration-150 font-sans text-xs font-semibold uppercase tracking-wider border",
                active
                  ? "bg-butter text-deep-brown font-bold border-deep-brown/10 shadow-sm"
                  : "border-transparent text-cream/80 hover:bg-cream/10 hover:text-butter",
              ].join(" ")}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-deep-brown" : "text-cream/70"}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Account + sign out */}
      <div className="shrink-0 border-t border-cream/15 p-3 bg-olive/80">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-butter text-deep-brown border border-deep-brown/10 text-xs font-sans font-bold shadow-sm">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-cream">{name}</p>
            {email && <p className="truncate text-[11px] font-sans text-cream/60">{email}</p>}
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-sans font-semibold uppercase tracking-wider text-cream/80 hover:bg-cream/10 hover:text-butter transition-all border border-transparent hover:border-cream/20"
          >
            <LogOut className="h-3.5 w-3.5 text-cream/70" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="fixed left-4 top-3.5 z-[60] flex h-9 w-9 items-center justify-center rounded-xl border border-deep-brown/15 bg-cream text-deep-brown shadow-sm lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-cream/15 bg-olive lg:flex shadow-sm">
        {content}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[70] lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-deep-brown/60 backdrop-blur-xs transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85%] bg-olive border-r border-cream/20 shadow-2xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-xl border border-cream/20 text-cream hover:bg-cream/10"
          >
            <X className="h-4 w-4" />
          </button>
          {content}
        </aside>
      </div>
    </>
  );
}
