"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Globe, MapPin, Star, ChevronRight, Users } from "lucide-react";
import type { Lead } from "@/hooks/use-leads";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

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
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3">
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-10 hidden sm:block" />
          </div>
        ))}
      </div>
    );
  }
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="p-3 rounded-full bg-muted">
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No leads found</p>
        <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="divide-y">
      {leads.map((lead) => (
        <motion.div
          key={lead.id}
          variants={item}
          className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="w-9 h-9 bg-gradient-brand rounded-lg flex items-center justify-center flex-shrink-0">
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
                <Star className="w-3 h-3 text-warning" />{lead.rating}
              </span>
            )}
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-primary">{lead.score}</div>
              <div className="text-[10px] text-muted-foreground">Score</div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={`/leads/${lead.id}`}><ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
