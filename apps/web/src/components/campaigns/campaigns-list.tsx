"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Megaphone, MapPin, Users, Star, MoreHorizontal, Loader2, ChevronRight, Download, Eye } from "lucide-react";
import { useCampaigns, type Campaign } from "@/hooks/use-campaigns";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function StatusBadge({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  if (campaign.status === "running") return (
    <div className="flex items-center gap-1.5">
      <Loader2 className="w-3 h-3 animate-spin text-info" />
      <span className="text-xs text-info font-medium">{campaign.progress}%</span>
    </div>
  );
  if (campaign.status === "completed") return <Badge variant="success">{t("camp.status.completed")}</Badge>;
  if (campaign.status === "failed") return <Badge variant="destructive">{t("camp.status.failed")}</Badge>;
  if (campaign.status === "draft") return <Badge variant="secondary">{t("camp.status.draft")}</Badge>;
  return <Badge variant="outline">{campaign.status === "paused" ? t("camp.status.paused") : campaign.status}</Badge>;
}

export function CampaignsList() {
  const { t, lang } = useI18n();
  const { campaigns, loading } = useCampaigns();
  const [search, setSearch] = useState("");

  const filtered = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("camp.list.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button asChild variant="gradient" className="ml-auto">
          <Link href="/campaigns/new"><Plus className="mr-2 h-4 w-4" />{t("camp.list.new")}</Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-medium">{t("camp.list.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mb-4">{t("camp.list.emptyDesc")}</p>
            <Button asChild variant="gradient">
              <Link href="/campaigns/new"><Plus className="mr-2 h-4 w-4" />{t("camp.list.new")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
          {filtered.map((c) => (
            <motion.div key={c.id} variants={item}>
              <Card interactive>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-brand rounded-xl flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-semibold text-sm">{c.name}</h3>
                        <StatusBadge campaign={c} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 capitalize"><Megaphone className="w-3 h-3" />{c.industry}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>
                        <span className="hidden sm:block">{new Date(c.createdAt).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      {c.status === "running" && (
                        <Progress value={c.progress} className="h-1 mt-2 max-w-[200px]" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-center">
                      <div className="hidden sm:block">
                        <div className="flex items-center gap-1 justify-center"><Users className="w-3 h-3 text-muted-foreground" /><span className="text-sm font-semibold">{c.totalLeads}</span></div>
                        <p className="text-xs text-muted-foreground">{t("camp.list.leads")}</p>
                      </div>
                      <div className="hidden sm:block">
                        <div className="flex items-center gap-1 justify-center"><Star className="w-3 h-3 text-warning" /><span className="text-sm font-semibold">{c.priorityLeads}</span></div>
                        <p className="text-xs text-muted-foreground">{t("camp.list.priority")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/campaigns/${c.id}`}><Eye className="w-3.5 h-3.5 mr-1" />{t("camp.list.viewDetails")}</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => api.download(`/export/leads/csv?campaignId=${c.id}`, `leads-${c.id}.csv`)}>
                            <Download className="w-3.5 h-3.5 mr-1" />{t("camp.list.exportCsv")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/campaigns/${c.id}`}><ChevronRight className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
