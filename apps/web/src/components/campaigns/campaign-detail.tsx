"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Users, Star, TrendingUp, MapPin, Loader2, Search } from "lucide-react";
import { useCampaign } from "@/hooks/use-campaigns";
import { useLeads } from "@/hooks/use-leads";
import { LeadsTable } from "@/components/leads/leads-table";

export function CampaignDetail({ id }: { id: string }) {
  const { campaign, loading, refresh } = useCampaign(id);
  const { leads, loading: leadsLoading, refresh: refreshLeads } = useLeads(id);

  // Poll while campaign is running
  useEffect(() => {
    if (campaign?.status !== "running") return;
    const interval = setInterval(async () => {
      await refresh();
      await refreshLeads();
    }, 2000);
    return () => clearInterval(interval);
  }, [campaign?.status, refresh, refreshLeads]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!campaign) {
    return <div className="text-center py-20 text-muted-foreground">Campaign not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{campaign.name}</h1>
            {campaign.status === "completed" && <Badge variant="success">Completed</Badge>}
            {campaign.status === "running" && (
              <Badge variant="info" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />{campaign.progress}%
              </Badge>
            )}
            {campaign.status === "draft" && <Badge variant="secondary">Draft</Badge>}
          </div>
          <p className="text-muted-foreground text-sm capitalize">{campaign.industry} · {campaign.location}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/export/leads/csv?campaignId=${id}`} download>
              <Download className="mr-2 h-4 w-4" />CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/export/leads/json?campaignId=${id}`} download>
              <Download className="mr-2 h-4 w-4" />JSON
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/export/leads/vcard?campaignId=${id}`} download>
              <Download className="mr-2 h-4 w-4" />vCard
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: campaign.totalLeads, icon: Users, color: "text-blue-500" },
          { label: "Priority Leads", value: campaign.priorityLeads, icon: Star, color: "text-amber-500" },
          { label: "High Quality", value: campaign.highQualityLeads, icon: TrendingUp, color: "text-emerald-500" },
          { label: "Avg Score", value: campaign.averageScore || "—", icon: MapPin, color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {campaign.status === "running" && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />Scraping in progress...
              </span>
              <span className="font-medium">{campaign.progress}%</span>
            </div>
            <Progress value={campaign.progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Leads ({leads.length})</CardTitle>
            <Button variant="outline" size="sm" className="text-xs">
              <Search className="mr-1 w-3 h-3" />Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <LeadsTable leads={leads} loading={leadsLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
