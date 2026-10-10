import { LeadsList } from "@/components/leads/leads-list";
import { PageHeading } from "@/components/layout/page-heading";

export default function LeadsPage() {
  return (
    <div>
      <div className="mb-6">
        <PageHeading title="page.leads.title" subtitle="page.leads.subtitle" />
      </div>
      <LeadsList />
    </div>
  );
}
