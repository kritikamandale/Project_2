import { AppShell } from "@/components/shared/app-shell";

// Wraps every authenticated USER page with the persistent left sidebar.
// Individual pages are untouched — the shell hides itself on the full-screen
// scan/onboarding flows (see app-shell.tsx).
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="user">{children}</AppShell>;
}
