"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download } from "lucide-react";
import { useLeads, useLeadMap, useRegions } from "@/hooks/use-leads";
import { Pager, LEADS_PAGE_SIZE as PAGE_SIZE } from "./pager";
import { RegionFilter, NO_REGION, type RegionValue } from "./region-filter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadsTable } from "./leads-table";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const LeadsMap = dynamic(() => import("./leads-map").then((m) => m.LeadsMap), { ssr: false, loading: () => <div className="h-[520px] w-full animate-pulse bg-muted" /> });

export function LeadsList() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [crmStatus, setCrmStatus] = useState("all");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "map">("list");
  const [region, setRegion] = useState<RegionValue>(NO_REGION);
  const { regions, geo, classify } = useRegions();
  const where = {
    q: debouncedQ || undefined,
    priority: priority !== "all" ? priority : undefined,
    status: crmStatus !== "all" ? crmStatus : undefined,
    province: region.province !== "all" ? region.province : undefined,
    regency: region.regency !== "all" ? region.regency : undefined,
    district: region.district !== "all" ? region.district : undefined,
  };

  const { leads, total, loading } = useLeads({ ...where, page, limit: PAGE_SIZE });
  const map = useLeadMap(where, view === "map");

  // Debounce search input to avoid too many API calls
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // A new filter starts again from the first page.
  useEffect(() => { setPage(1); }, [debouncedQ, priority, crmStatus, region]);


  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("leads.list.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("leads.list.priority")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.list.allPriorities")}</SelectItem>
            <SelectItem value="HIGH">{t("leads.priority.HIGH")}</SelectItem>
            <SelectItem value="MEDIUM">{t("leads.priority.MEDIUM")}</SelectItem>
            <SelectItem value="LOW">{t("leads.priority.LOW")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={crmStatus} onValueChange={setCrmStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("leads.list.crmStatus")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.list.allStatuses")}</SelectItem>
            <SelectItem value="new">{t("leads.crm.new")}</SelectItem>
            <SelectItem value="contacted">{t("leads.crm.contacted")}</SelectItem>
            <SelectItem value="replied">{t("leads.crm.replied")}</SelectItem>
            <SelectItem value="interested">{t("leads.crm.interested")}</SelectItem>
            <SelectItem value="meeting">{t("leads.crm.meeting")}</SelectItem>
            <SelectItem value="won">{t("leads.crm.won")}</SelectItem>
            <SelectItem value="lost">{t("leads.crm.lost")}</SelectItem>
          </SelectContent>
        </Select>
        <RegionFilter regions={regions} geo={geo} value={region} onChange={setRegion} onClassify={() => void classify()} />
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "map")}>
          <TabsList>
            <TabsTrigger value="list" className="text-xs">{t("leads.view.list")}</TabsTrigger>
            <TabsTrigger value="map" className="text-xs">{t("leads.view.map")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          {!loading && <span className="text-xs text-muted-foreground">{t("leads.list.count", { n: total })}</span>}
          <Button variant="outline" onClick={() => api.download("/export/leads/csv", "leads-all.csv")}>
            <Download className="mr-2 h-4 w-4" />{t("leads.list.export")}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {view === "list" ? (
            <>
              <LeadsTable leads={leads} loading={loading} />
              <Pager page={page} total={total} loading={loading} onPage={setPage} />
            </>
          ) : map.loading ? (
            <div className="h-[520px] w-full animate-pulse bg-muted" />
          ) : (
            <LeadsMap leads={map.points} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
