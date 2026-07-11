"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";

// Routes that are intentionally full-screen / focused flows and must NOT get the
// app sidebar: the immersive camera capture and the first-run onboarding stepper
// (which has its own progress header). Everything else in the group is wrapped.
const IMMERSIVE = [/^\/scan(?:\/|$)/, /^\/onboarding(?:\/|$)/];

export function AppShell({
  area,
  children,
}: {
  area: "user" | "derm";
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";

  if (IMMERSIVE.some((re) => re.test(pathname))) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <AppSidebar area={area} />
      {/* Offset content by the sidebar width on desktop; full width on mobile. */}
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
