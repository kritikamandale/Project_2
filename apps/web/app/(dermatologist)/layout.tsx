import { AppShell } from "@/components/shared/app-shell";

// Wraps every DERMATOLOGIST page with the persistent left sidebar.
export default function DermatologistLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="derm">{children}</AppShell>;
}
