"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

interface LeadRow { id: string; name: string; phone: string | null; category: string | null; crmStatus: string; dealValue: number | null; lastIntent: string | null; repliedAt: string | null; contactedAt: string | null; followUpDate: string | null }
interface Pipeline {
  stages: { stage: string; count: number; value: number }[];
  pipelineValue: number;
  wonValue: number;
  rates: { replyRate: number | null; winRate: number | null };
  needsReply: LeadRow[];
  stale: LeadRow[];
  dueFollowUps: LeadRow[];
  unmatched: { id: string; fromPhone: string; body: string; receivedAt: string; hidden: boolean }[];
  lostReasons: { reason: string; count: number }[];
  campaigns: { id: string; name: string; total: number; contacted: number; replied: number; won: number }[];
}

const money = (n: number) => n.toLocaleString("id-ID");
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export function PipelinePage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<Pipeline | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<Pipeline>("/analytics/pipeline").then(setData).catch(() => setError(true));
  }, []);

  if (error) return <p className="p-6 text-sm text-destructive">{t("pipeline.error")}</p>;
  if (!data) return <div className="space-y-4 p-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const max = Math.max(1, ...data.stages.map((s) => s.count));
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short" }) : "");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pipeline.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("pipeline.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("pipeline.replyRate")} value={pct(data.rates.replyRate)} />
        <Stat label={t("pipeline.winRate")} value={pct(data.rates.winRate)} />
        <Stat label={t("pipeline.value")} value={money(data.pipelineValue)} />
        <Stat label={t("pipeline.won")} value={money(data.wonValue)} />
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {data.stages.map((s) => (
            <div key={s.stage} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
              <span>{t(`leads.crm.${s.stage}` as MessageKey)}</span>
              <div className="h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(s.count / max) * 100}%` }} /></div>
              <span className="text-right tabular-nums">{s.count}{s.value > 0 && <span className="text-muted-foreground"> · {money(s.value)}</span>}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <LeadList title={t("pipeline.needsReply")} empty={t("pipeline.needsReply.empty")} rows={data.needsReply} note={(l) => (l.lastIntent ? t(`pipeline.intent.${l.lastIntent}` as MessageKey) : date(l.repliedAt))} />
        <LeadList title={t("pipeline.due")} empty={t("pipeline.due.empty")} rows={data.dueFollowUps} note={(l) => date(l.followUpDate)} />
        <LeadList title={t("pipeline.stale")} empty={t("pipeline.stale.empty")} rows={data.stale} note={(l) => date(l.contactedAt)} />
      </div>

      {data.unmatched.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base">{t("pipeline.unmatched")}<Badge variant="secondary">{data.unmatched.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="text-xs text-muted-foreground">{t("pipeline.unmatched.hint")}</p>
            {data.unmatched.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                <span className="line-clamp-2">{m.body}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{date(m.receivedAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("pipeline.byCampaign")}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="pb-2 font-normal">{t("pipeline.col.campaign")}</th><th className="pb-2 font-normal">{t("pipeline.col.leads")}</th><th className="pb-2 font-normal">{t("pipeline.col.contacted")}</th><th className="pb-2 font-normal">{t("pipeline.col.replied")}</th><th className="pb-2 font-normal">{t("pipeline.col.won")}</th></tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.id} className="border-t"><td className="py-2 pr-3"><Link href={`/campaigns/${c.id}`} className="hover:underline">{c.name}</Link></td><td className="tabular-nums">{c.total}</td><td className="tabular-nums">{c.contacted}</td><td className="tabular-nums">{c.replied}</td><td className="tabular-nums">{c.won}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("pipeline.lostReasons")}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {data.lostReasons.length === 0 && <p className="text-muted-foreground">{t("pipeline.lostReasons.empty")}</p>}
            {data.lostReasons.map((r) => <div key={r.reason} className="flex justify-between gap-2"><span>{r.reason}</span><span className="tabular-nums">{r.count}</span></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="pt-5"><div className="text-2xl font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>;
}

function LeadList({ title, empty, rows, note }: { title: string; empty: string; rows: LeadRow[]; note: (l: LeadRow) => string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base">{title}<Badge variant="secondary">{rows.length}</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">{empty}</p>}
        {rows.map((l) => (
          <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
            <span className="truncate">{l.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{note(l)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
