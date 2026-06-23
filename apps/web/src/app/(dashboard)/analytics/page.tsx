import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Performance insights and metrics</p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
