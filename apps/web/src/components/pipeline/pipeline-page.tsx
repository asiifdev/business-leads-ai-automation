"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

interface LeadRow { id: string; name: string; phone: string | null; category: string | null; crmStatus: string; dealValue: number | null; lastIntent: string | null; repliedAt: string | null; contactedAt: string | null; followUpDate: string | null }
interface Pipeline {
  stages: { stage: string; count: number; value: number }[];
  pipelineValue: number;
  wonValue: number;
  rates: { replyRate: number | null; winRate: number | null };
  totals: { needsReply: number; stale: number; dueFollowUps: number; unmatched: number; waitingOnThem: number };
  waitingOnThem: LeadRow[];
  needsReply: LeadRow[];
  stale: LeadRow[];
  dueFollowUps: LeadRow[];
  unmatched: { id: string; fromPhone: string; body: string; receivedAt: string; hidden: boolean }[];
  lostReasons: { reason: string; count: number }[];
  campaigns: { id: string; name: string; total: number; contacted: number; replied: number; won: number }[];
}

const money = (n: number) => n.toLocaleString("id-ID");
interface Reclassified {
  applied: boolean; scanned: number; changed: number; answeredByOwner: number; intentChanged: number; stageMoved: number; botOnly: number; optedOut: number; incomplete: number; draftsWithdrawn: number; draftsRewritten: number;
  sample: { leadId: string; name: string; answeredByOwner: boolean; botOnly: boolean; optOut: boolean; intent: { from: string | null; to: string }; stage: { from: string; to: string }; staleDrafts: number }[];
}

/** Reads every conversation again. It shows what would change first; nothing is touched until "Apply". */
function ReclassifyPanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "checking" | "applying">("idle");
  const [result, setResult] = useState<Reclassified | null>(null);
  const label = (v: string | null) => (v ? t(`pipeline.intent.${v}` as MessageKey) : "-");

  const check = async () => {
    setState("checking");
    try { setResult(await api.post<Reclassified>("/messaging/reclassify", { apply: false })); } catch (e) { toast.error((e as Error).message); } finally { setState("idle"); }
  };
  const apply = async () => {
    setState("applying");
    try {
      const r = await api.post<Reclassified>("/messaging/reclassify", { apply: true });
      toast.success(t("pipeline.reclassify.applied", { changed: r.changed, withdrawn: r.draftsWithdrawn, rewritten: r.draftsRewritten }));
      setResult(null);
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setState("idle"); }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-muted-foreground">{t("pipeline.reclassify.hint")}</p>
        <Button size="sm" variant="outline" disabled={state !== "idle"} onClick={check}>
          {state === "checking" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}{state === "checking" ? t("pipeline.reclassify.checking") : t("pipeline.reclassify")}
        </Button>
      </div>
      {result && (
        <div className="mt-3 space-y-2 text-sm">
          {result.changed === 0 ? (
            <p className="text-muted-foreground">{t("pipeline.reclassify.none", { scanned: result.scanned })}</p>
          ) : (
            <>
              <p className="font-medium">{t("pipeline.reclassify.preview", { changed: result.changed, scanned: result.scanned })}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                {result.answeredByOwner > 0 && <li>{t("pipeline.reclassify.answered", { n: result.answeredByOwner })}</li>}
                {result.intentChanged > 0 && <li>{t("pipeline.reclassify.intent", { n: result.intentChanged })}</li>}
                {result.optedOut > 0 && <li className="font-medium text-foreground">{t("pipeline.reclassify.optout", { n: result.optedOut })}</li>}
                {result.botOnly > 0 && <li>{t("pipeline.reclassify.bot", { n: result.botOnly })}</li>}
                {result.incomplete > 0 && <li>{t("pipeline.reclassify.incomplete", { n: result.incomplete })}</li>}
                {result.stageMoved > 0 && <li>{t("pipeline.reclassify.stage", { n: result.stageMoved })}</li>}
                {result.draftsWithdrawn > 0 && <li>{t("pipeline.reclassify.drafts", { n: result.draftsWithdrawn })}</li>}
              </ul>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {result.sample.map((c) => (
                  <li key={c.leadId} className="truncate">
                    {c.name}: {c.optOut ? t("pipeline.reclassify.optoutRow") : c.botOnly ? t("pipeline.reclassify.botRow") : c.answeredByOwner ? t("pipeline.reclassify.youAnswered") : `${label(c.intent.from)} → ${label(c.intent.to)}`}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button size="sm" disabled={state !== "idle"} onClick={apply}>{state === "applying" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}{t("pipeline.reclassify.apply")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setResult(null)}>{t("pipeline.reclassify.cancel")}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export function PipelinePage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<Pipeline | null>(null);
  const [error, setError] = useState(false);

  const markHandled = async (id: string) => {
    try { await api.patch(`/leads/${id}/crm`, { needsReply: false }); toast.success(t("pipeline.handled.done")); await load(); } catch (e) { toast.error((e as Error).message); }
  };
  const load = () => api.get<Pipeline>("/analytics/pipeline").then(setData).catch(() => setError(true));
  useEffect(() => { void load(); }, []);

  if (error) return <p className="p-6 text-sm text-destructive">{t("pipeline.error")}</p>;
  if (!data) return <div className="space-y-4 p-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const max = Math.max(1, ...data.stages.map((s) => s.count));
  // "2 jam yang lalu" / "3 days ago": how long it has been, which is what decides who to look at first
  const ago = (v: string | null) => {
    if (!v) return "";
    const mins = Math.round((new Date(v).getTime() - Date.now()) / 60_000);
    const rtf = new Intl.RelativeTimeFormat(lang === "id" ? "id" : "en", { numeric: "auto" });
    if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
    if (Math.abs(mins) < 1440) return rtf.format(Math.round(mins / 60), "hour");
    return rtf.format(Math.round(mins / 1440), "day");
  };
  const intentBadge = (l: LeadRow): { label: string; tone: BadgeTone } | null =>
    l.lastIntent ? { label: t(`pipeline.intent.${l.lastIntent}` as MessageKey), tone: INTENT_TONE[l.lastIntent] ?? "secondary" } : null;
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short" }) : "");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pipeline.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("pipeline.subtitle")}</p>
      </div>

      <ReclassifyPanel onDone={() => void load()} />

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

      <div className="space-y-4">
        <LeadList wide title={t("pipeline.needsReply")} empty={t("pipeline.needsReply.empty")} rows={data.needsReply} total={data.totals.needsReply} onHandled={markHandled} badge={intentBadge} when={(l) => ago(l.repliedAt)} />
        <div className="grid gap-4 lg:grid-cols-3">
          <LeadList title={t("pipeline.due")} empty={t("pipeline.due.empty")} rows={data.dueFollowUps} total={data.totals.dueFollowUps} when={(l) => date(l.followUpDate)} />
          <LeadList title={t("pipeline.waiting")} empty={t("pipeline.waiting.empty")} hint={t("pipeline.waiting.hint")} rows={data.waitingOnThem} total={data.totals.waitingOnThem} badge={intentBadge} when={(l) => ago(l.contactedAt)} />
          <LeadList title={t("pipeline.stale")} empty={t("pipeline.stale.empty")} rows={data.stale} total={data.totals.stale} when={(l) => ago(l.contactedAt)} />
        </div>
      </div>

      {data.unmatched.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base">{t("pipeline.unmatched")}<Badge variant="secondary">{data.totals.unmatched}</Badge></CardTitle></CardHeader>
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

type BadgeTone = "secondary" | "info" | "warning" | "success" | "destructive";
const INTENT_TONE: Record<string, BadgeTone> = { interested: "success", meeting: "success", price: "info", question: "info", referral: "warning", not_interested: "destructive" };

/**
 * One list on the Pipeline page: the name takes the room it needs, a coloured chip says what they meant, the time says how long
 * ago, and (where it makes sense) a quiet check marks a lead you already answered from your phone.
 */
function LeadList({ title, empty, hint, rows, total, when, badge, onHandled, wide }: { title: string; empty: string; hint?: string; rows: LeadRow[]; total: number; when: (l: LeadRow) => string; badge?: (l: LeadRow) => { label: string; tone: BadgeTone } | null; onHandled?: (id: string) => void; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-start justify-between gap-3 text-base leading-snug">{title}<Badge variant="secondary" className="shrink-0">{total}</Badge></CardTitle>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent className="text-sm">
        {total > rows.length && <p className="mb-2 text-xs text-muted-foreground">{t("pipeline.showing", { shown: rows.length, total })}</p>}
        {rows.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{empty}</p>}
        <ul className={`max-h-[28rem] overflow-y-auto pr-1 ${wide ? "grid gap-x-6 md:grid-cols-2" : ""}`}>
          {rows.map((l) => {
            const chip = badge?.(l);
            return (
              <li key={l.id} className="flex items-center gap-1 rounded-md hover:bg-muted">
                <Link href={`/leads/${l.id}`} className="min-w-0 flex-1 px-2 py-2">
                  <p className="truncate font-medium" title={l.name}>{l.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {chip && <Badge variant={chip.tone} className="whitespace-nowrap">{chip.label}</Badge>}
                    <span className="tabular-nums">{when(l)}</span>
                  </div>
                </Link>
                {onHandled && (
                  <button type="button" title={t("pipeline.handled.hint")} aria-label={t("pipeline.handled")} onClick={() => onHandled(l.id)} className="mr-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
