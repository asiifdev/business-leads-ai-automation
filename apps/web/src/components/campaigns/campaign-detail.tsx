"use client";
import { useEffect, useState } from "react";
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
import { useLeads, useLeadMap } from "@/hooks/use-leads";
import { Input } from "@/components/ui/input";
import { Pager, LEADS_PAGE_SIZE } from "@/components/leads/pager";
import { CampaignConfig } from "@/components/campaigns/campaign-config";
import { LeadsTable } from "@/components/leads/leads-table";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const { campaign, loading, refresh } = useCampaign(id);
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState<string | null>(null);
  const enrichAll = async () => {
    setEnriching(true); setEnrichNote(null);
    try {
      const r = await api.post<{ processed: number; withEmail: number; withWhatsapp: number }>(`/leads/enrich/campaign/${id}`, {});
      setEnrichNote(r.processed === 0 ? t("leads.enrich.campaignNone") : t("leads.enrich.campaignDone", { n: r.processed, email: r.withEmail, wa: r.withWhatsapp }));
    } catch (e) { setEnrichNote((e as Error).message); } finally { setEnriching(false); }
  };
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("list");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const h = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); return () => clearTimeout(h); }, [search]);
  const { leads, total: leadsTotal, loading: leadsLoading, refresh: refreshLeads } = useLeads({ campaignId: id, q: q || undefined, page, limit: LEADS_PAGE_SIZE });
  const leadMap = useLeadMap({ campaignId: id, q: q || undefined }, tab === "map");

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
    return <div className="text-center py-20 text-muted-foreground">{t("camp.detail.notFound")}</div>;
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
            {campaign.status === "completed" && <Badge variant="success">{t("camp.status.completed")}</Badge>}
            {campaign.status === "running" && (
              <Badge variant="info" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />{campaign.progress}%
              </Badge>
            )}
            {campaign.status === "draft" && <Badge variant="secondary">{t("camp.status.draft")}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm capitalize">{campaign.industry} · {campaign.location}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={enrichAll} disabled={enriching}>
            {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {enriching ? t("leads.enrich.finding") : t("leads.enrich.campaign")}
          </Button>
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

      {enrichNote && <p role="status" className="text-sm text-muted-foreground">{enrichNote}</p>}

      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("camp.detail.totalLeads"), value: campaign.totalLeads, icon: Users, color: "text-info" },
          { label: t("camp.detail.priorityLeads"), value: campaign.priorityLeads, icon: Star, color: "text-warning" },
          { label: t("camp.detail.highQuality"), value: campaign.highQualityLeads, icon: TrendingUp, color: "text-success" },
          { label: t("camp.detail.avgScore"), value: campaign.averageScore || "—", icon: MapPin, color: "text-primary" },
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

      <motion.div variants={item}>
        <CampaignConfig campaign={campaign} />
      </motion.div>

      {campaign.status === "running" && (
        <motion.div variants={item}>
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-info" />{t("camp.detail.scraping")}
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
          <Tabs value={tab} onValueChange={setTab}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("camp.detail.leadsTitle", { n: leadsTotal })}</CardTitle>
                <div className="flex items-center gap-2">
                  <TabsList>
                    <TabsTrigger value="list" className="text-xs">
                      <List className="mr-1 w-3 h-3" />{t("camp.detail.tabList")}
                    </TabsTrigger>
                    <TabsTrigger value="map" className="text-xs">
                      <MapIcon className="mr-1 w-3 h-3" />{t("camp.detail.tabMap")}
                    </TabsTrigger>
                  </TabsList>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("leads.list.search")} className="h-8 w-64 pl-7 text-xs" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <TabsContent value="list" className="mt-0">
              <CardContent className="p-0">
                <LeadsTable leads={leads} loading={leadsLoading} />
                <Pager page={page} total={leadsTotal} loading={leadsLoading} onPage={setPage} />
              </CardContent>
            </TabsContent>
            <TabsContent value="map" className="mt-0">
              <CardContent className="p-0">
                {leadMap.loading ? (
                  <div className="h-[520px] w-full animate-pulse bg-muted" />
                ) : (
                  <LeadsMap leads={leadMap.points} />
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>
    </motion.div>
  );
}
