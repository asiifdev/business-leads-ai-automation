import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { PageHeading } from "@/components/layout/page-heading";

export default function CampaignsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageHeading title="page.campaigns.title" subtitle="page.campaigns.subtitle" />
        </div>
      </div>
      <CampaignsList />
    </div>
  );
}
