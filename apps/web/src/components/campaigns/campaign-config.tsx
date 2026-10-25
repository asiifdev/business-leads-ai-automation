"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { countryLabel } from "@/lib/countries";
import { languageLabel } from "@/lib/languages";
import type { Campaign } from "@/hooks/use-campaigns";

const IND = ["restaurant", "cafe", "retail", "automotive", "healthcare", "beauty", "education", "realestate", "event", "tech", "professional"];
const STYLES = ["professional", "friendly", "balanced", "casual"];

/** What this campaign was set up to do: the offer, where it looks, how it writes. */
export function CampaignConfig({ campaign }: { campaign: Campaign & { maxResults?: number } }) {
  const { t, lang } = useI18n();
  const label = (prefix: string, values: string[], v: string) => (values.includes(v) ? t(`${prefix}.${v}` as MessageKey) : v);
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "—");
  const queries = campaign.searchQueries?.length ? campaign.searchQueries : campaign.searchQuery ? [campaign.searchQuery] : [];

  const rows: [string, string][] = [
    [t("camp.cfg.industry"), label("camp.ind", IND, campaign.industry)],
    [t("camp.cfg.country"), countryLabel(campaign.country ?? "ID", lang)],
    [t("camp.cfg.location"), campaign.location],
    [t("camp.cfg.sources"), (campaign.sources?.length ? campaign.sources : ["google_maps"]).map((s) => (s === "google_maps" || s === "osm" || s === "overture" ? t(`camp.src.${s}` as MessageKey) : s)).join(", ")],
    [t("camp.cfg.maxResults"), campaign.maxResults ? t("camp.form.leadsCount", { n: campaign.maxResults }) : "—"],
    [t("camp.cfg.style"), label("camp.style", STYLES, campaign.contentStyle)],
    [t("camp.cfg.language"), languageLabel(campaign.language, lang)],
    [t("camp.cfg.created"), date(campaign.createdAt)],
    [t("camp.cfg.completed"), date(campaign.completedAt)],
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <CardTitle className="text-base">{t("camp.cfg.title")}</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link href={`/outbox?campaign=${campaign.id}`}><Send className="mr-1.5 h-4 w-4" />{t("camp.cfg.writeDrafts")}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">{t("camp.cfg.offer")}</div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{campaign.yourService || "—"}</p>
        </div>
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">{t("camp.cfg.queries")} ({queries.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {queries.map((q) => <span key={q} className="rounded-md bg-muted px-2 py-1 text-xs">{q}</span>)}
            {queries.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
