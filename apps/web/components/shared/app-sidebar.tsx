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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Persistent left navigation for the authenticated app areas.
// Desktop (lg+): fixed sidebar. Mobile: slide-in drawer via a hamburger.
// Styled entirely with the existing skin-*/teal-*/zinc-* palette tokens.
// ---------------------------------------------------------------------------

type Area = "user" | "derm";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV: Record<Area, NavItem[]> = {
  user: [
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/scan", label: "New Scan", Icon: Camera },
    { href: "/progress", label: "Progress", Icon: TrendingUp },
    { href: "/roadmap", label: "Roadmap", Icon: Map },
    { href: "/history", label: "History", Icon: History },
    { href: "/results", label: "Results", Icon: BarChart3 },
    { href: "/profile", label: "Profile", Icon: User },
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const content = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-skin-100/70 px-5">
        <Link
          href={HOME[area]}
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 shadow-sm">
            <span className="font-bold text-white">S</span>
          </div>
          <span className="font-heading text-lg font-bold text-zinc-800">Skinest</span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-skin-500/10 font-semibold text-skin-700"
                  : "font-medium text-zinc-500 hover:bg-skin-50 hover:text-skin-700",
              ].join(" ")}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? "text-skin-600" : "text-zinc-400"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Account + sign out */}
      <div className="shrink-0 border-t border-skin-100/70 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 text-sm font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-800">{name}</p>
            {email && <p className="truncate text-xs text-zinc-400">{email}</p>}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-5 w-5 shrink-0 text-zinc-400" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="fixed left-3 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-xl border border-skin-100 bg-white/90 text-zinc-700 shadow-sm backdrop-blur lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-skin-100 bg-white/85 backdrop-blur-xl lg:flex">
        {content}
      </aside>

      {/* Mobile drawer (always mounted for a smooth slide) */}
      <div
        className={`fixed inset-0 z-[70] lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[82%] bg-white shadow-2xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
          {content}
        </aside>
      </div>
    </>
  );
}
