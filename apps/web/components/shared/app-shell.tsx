"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";

export function AppShell({
  area,
  children,
}: {
  area: "user" | "derm";
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const isOnboardingFlow = pathname.startsWith("/onboarding/") || pathname === "/scan";

  return (
    <div className="flex h-dvh overflow-hidden bg-cream text-deep-brown font-sans">
      <AppSidebar area={area} />
      {/* Offset content by sidebar width on desktop (lg:pl-64) with fixed header */}
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden lg:pl-64">
        {area === "user" && !isOnboardingFlow && <AppHeader />}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
