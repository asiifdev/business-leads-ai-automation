"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Globe, MapPin, Star, ChevronRight, Loader2 } from "lucide-react";
import type { Lead } from "@/hooks/use-leads";

function PriorityBadge({ priority }: { priority: Lead["priority"] }) {
  if (priority === "HIGH") return <Badge variant="success">High</Badge>;
  if (priority === "MEDIUM") return <Badge variant="warning">Medium</Badge>;
  return <Badge variant="secondary">Low</Badge>;
}

function CrmBadge({ status }: { status: Lead["crmStatus"] }) {
  const map: Record<Lead["crmStatus"], "secondary" | "info" | "warning" | "success" | "destructive"> = {
    new: "secondary",
    contacted: "info",
    replied: "info",
    meeting: "warning",
    proposal: "warning",
    won: "success",
    lost: "destructive",
  };
  return <Badge variant={map[status]} className="capitalize">{status}</Badge>;
}

interface Props {
  leads: Lead[];
  loading: boolean;
}

export function LeadsTable({ leads, loading }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (leads.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">No leads found</div>;
  }

  return (
    <div className="divide-y">
      {leads.map((lead) => (
        <div key={lead.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{lead.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-medium text-sm truncate">{lead.name}</span>
              <PriorityBadge priority={lead.priority} />
              <CrmBadge status={lead.crmStatus} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {lead.address && (
                <span className="flex items-center gap-1 truncate max-w-[200px]">
                  <MapPin className="w-3 h-3 flex-shrink-0" />{lead.address}
                </span>
              )}
              {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
              {lead.website && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{lead.website}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {lead.rating && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3 text-amber-500" />{lead.rating}
              </span>
            )}
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-purple-600">{lead.score}</div>
              <div className="text-[10px] text-muted-foreground">Score</div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={`/leads/${lead.id}`}><ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
