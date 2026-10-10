import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeading } from "@/components/layout/page-heading";

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-6">
        <PageHeading title="page.analytics.title" subtitle="page.analytics.subtitle" />
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
