"use client";
import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Download, Users, Star, TrendingUp, MapPin, Loader2, Search, List, Map as MapIcon } from "lucide-react";
import { useCampaign } from "@/hooks/use-campaigns";
import { useLeads } from "@/hooks/use-leads";
import { LeadsTable } from "@/components/leads/leads-table";
import { api } from "@/lib/api";

const LeadsMap = dynamic(() => import("@/components/leads/leads-map").then((m) => m.LeadsMap), {
  ssr: false,
  loading: () => <div className="h-[520px] w-full animate-pulse bg-muted" />,
});

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function CampaignDetail({ id }: { id: string }) {
  const { campaign, loading, refresh } = useCampaign(id);
  const { leads, loading: leadsLoading, refresh: refreshLeads } = useLeads({ campaignId: id });

  // Poll while campaign is running
  useEffect(() => {
    if (campaign?.status !== "running") return;
    const interval = setInterval(async () => {
      await refresh();
      await refreshLeads();
    }, 5000);
    return () => clearInterval(interval);
  }, [campaign?.status, refresh, refreshLeads]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  if (!campaign) {
    return <div className="text-center py-20 text-muted-foreground">Campaign not found</div>;
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center gap-4">
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
          <Button variant="outline" size="sm" onClick={() => api.download(`/export/leads/csv?campaignId=${id}`, `leads-${id}.csv`)}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.download(`/export/leads/json?campaignId=${id}`, `leads-${id}.json`)}>
            <Download className="mr-2 h-4 w-4" />JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.download(`/export/leads/vcard?campaignId=${id}`, `leads-${id}.vcf`)}>
            <Download className="mr-2 h-4 w-4" />vCard
          </Button>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: campaign.totalLeads, icon: Users, color: "text-info" },
          { label: "Priority Leads", value: campaign.priorityLeads, icon: Star, color: "text-warning" },
          { label: "High Quality", value: campaign.highQualityLeads, icon: TrendingUp, color: "text-success" },
          { label: "Avg Score", value: campaign.averageScore || "—", icon: MapPin, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label} interactive>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {campaign.status === "running" && (
        <motion.div variants={item}>
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-info" />Scraping in progress...
                </span>
                <span className="font-medium">{campaign.progress}%</span>
              </div>
              <Progress value={campaign.progress} className="h-2" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={item}>
        <Card>
          <Tabs defaultValue="list">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Leads ({leads.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <TabsList>
                    <TabsTrigger value="list" className="text-xs">
                      <List className="mr-1 w-3 h-3" />List
                    </TabsTrigger>
                    <TabsTrigger value="map" className="text-xs">
                      <MapIcon className="mr-1 w-3 h-3" />Map
                    </TabsTrigger>
                  </TabsList>
                  <Button variant="outline" size="sm" className="text-xs">
                    <Search className="mr-1 w-3 h-3" />Filter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <TabsContent value="list" className="mt-0">
              <CardContent className="p-0">
                <LeadsTable leads={leads} loading={leadsLoading} />
              </CardContent>
            </TabsContent>
            <TabsContent value="map" className="mt-0">
              <CardContent className="p-0">
                {leadsLoading ? (
                  <div className="h-[520px] w-full animate-pulse bg-muted" />
                ) : (
                  <LeadsMap leads={leads} />
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>
    </motion.div>
  );
}
