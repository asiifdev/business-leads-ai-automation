import type { Metadata } from "next";
import { CreateCampaignForm } from "@/components/campaigns/create-campaign-form";

export const metadata: Metadata = { title: "New Campaign | Prospex" };

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New Campaign</h1>
        <p className="text-muted-foreground text-sm">Set up a lead discovery campaign</p>
      </div>
      <CreateCampaignForm />
    </div>
  );
}
