import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { CreateCampaignForm } from "@/components/campaigns/create-campaign-form";

export const metadata: Metadata = { title: "New Campaign | Prospex" };

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <PageHeading title="page.newCampaign.title" subtitle="page.newCampaign.subtitle" small />
      </div>
      <CreateCampaignForm />
    </div>
  );
}
