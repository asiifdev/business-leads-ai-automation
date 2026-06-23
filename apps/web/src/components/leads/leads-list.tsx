"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download } from "lucide-react";
import { useLeads } from "@/hooks/use-leads";
import { LeadsTable } from "./leads-table";
import { api } from "@/lib/api";

export function LeadsList() {
  const { leads, loading } = useLeads();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [crmStatus, setCrmStatus] = useState("all");

  const filtered = leads.filter((l) => {
    const matchSearch =
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.address || "").toLowerCase().includes(search.toLowerCase());
    const matchPriority = priority === "all" || l.priority === priority;
    const matchCrm = crmStatus === "all" || l.crmStatus === crmStatus;
    return matchSearch && matchPriority && matchCrm;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={crmStatus} onValueChange={setCrmStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="CRM Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="ml-auto" onClick={() => api.download("/export/leads/csv", "leads-all.csv")}>
          <Download className="mr-2 h-4 w-4" />Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <LeadsTable leads={filtered} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
