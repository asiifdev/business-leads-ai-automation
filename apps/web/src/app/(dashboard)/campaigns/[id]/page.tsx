import { CampaignDetail } from "@/components/campaigns/campaign-detail";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignDetail id={id} />;
}
