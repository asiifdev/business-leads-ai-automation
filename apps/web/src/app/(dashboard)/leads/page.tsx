import { LeadsList } from "@/components/leads/leads-list";

export default function LeadsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground">All leads across your campaigns</p>
      </div>
      <LeadsList />
    </div>
  );
}
