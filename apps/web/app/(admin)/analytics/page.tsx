// analytics/ redirects to admin-dashboard which contains all chart sections
import { redirect } from "next/navigation";

export default function AnalyticsPage() {
  redirect("/admin-dashboard");
}
