import { CampaignsList } from "@/components/campaigns/campaigns-list";

export default function CampaignsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Manage your lead generation campaigns</p>
        </div>
      </div>
      <CampaignsList />
    </div>
  );
}
