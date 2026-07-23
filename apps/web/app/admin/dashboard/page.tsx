import { StatsOverview } from "@/components/admin/stats-overview";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-skin-50/80 via-white to-teal-50/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-900 mb-1">Admin overview</h1>
        <p className="text-sm text-zinc-500 mb-6">Platform-wide KPIs, updated in real time.</p>
        <StatsOverview />
      </div>
    </div>
  );
}
