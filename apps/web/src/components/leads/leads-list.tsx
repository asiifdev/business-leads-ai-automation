"use client";
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download } from "lucide-react";
import { useLeads } from "@/hooks/use-leads";
import { LeadsTable } from "./leads-table";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function LeadsList() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [crmStatus, setCrmStatus] = useState("all");
  const [debouncedQ, setDebouncedQ] = useState("");

  const { leads, total, loading } = useLeads({
    q: debouncedQ || undefined,
    priority: priority !== "all" ? priority : undefined,
    status: crmStatus !== "all" ? crmStatus : undefined,
  });

  // Debounce search input to avoid too many API calls
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    const id = setTimeout(() => setDebouncedQ(value), 350);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("leads.list.search")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
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
            <SelectItem value="meeting">{t("leads.crm.meeting")}</SelectItem>
            <SelectItem value="won">{t("leads.crm.won")}</SelectItem>
            <SelectItem value="lost">{t("leads.crm.lost")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {!loading && <span className="text-xs text-muted-foreground">{t("leads.list.count", { n: total })}</span>}
          <Button variant="outline" onClick={() => api.download("/export/leads/csv", "leads-all.csv")}>
            <Download className="mr-2 h-4 w-4" />{t("leads.list.export")}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <LeadsTable leads={leads} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
