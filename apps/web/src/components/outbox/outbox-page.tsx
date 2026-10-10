"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { MessageCard } from "./message-card";
import { WhatsappPanel } from "./whatsapp-panel";
import type { Counts, GenerationJob, Overview, OutboxMessage } from "./types";

/* Hallmark · component: page (Outbox) · genre: modern-minimal · theme: existing Prospex tokens
 * layout: connection strip + tabbed review list (one column, reading width) · no new colours or fonts
 */

type Tab = "review" | "queue" | "sent" | "attention";
const TAB_STATUS: Record<Tab, string> = { review: "draft", queue: "approved,sending", sent: "sent", attention: "failed" };
const TAB_COUNT: Record<Tab, string[]> = { review: ["draft"], queue: ["approved", "sending"], sent: ["sent"], attention: ["failed"] };

interface CampaignOption { id: string; name: string }

export function OutboxPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("review");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [items, setItems] = useState<OutboxMessage[] | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const preselected = useSearchParams().get("campaign") ?? "";
  const [campaignId, setCampaignId] = useState(preselected);
  const [howMany, setHowMany] = useState(20);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const wasRunning = useRef(false);

  const load = useCallback(async () => {
    try {
      const [o, c, list, j] = await Promise.all([
        api.get<Overview>("/messaging/whatsapp"),
        api.get<Counts>("/messaging/outbox/counts"),
        api.get<OutboxMessage[]>(`/messaging/outbox?status=${TAB_STATUS[tab]}&limit=100`),
        api.get<GenerationJob | null>("/messaging/outbox/generate/status"),
      ]);
      setOverview(o); setCounts(c); setItems(list); setJob(j);
    } catch (e) {
      if ((e as Error).message !== "Unauthorized") toast.error(t("outbox.error.load"));
    }
  }, [tab, t]);

  useEffect(() => { setItems(null); setConfirmAll(false); void load(); }, [load]);
  useEffect(() => { api.get<CampaignOption[]>("/campaigns").then(setCampaigns).catch(() => setCampaigns([])); }, []);

  // Poll faster while something is changing (pairing, drafting), slower otherwise.
  const fast = job?.running || overview?.account.status === "connecting" || overview?.account.status === "qr";
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) void load(); }, fast ? 2500 : 10000);
    return () => clearInterval(id);
  }, [load, fast]);

  useEffect(() => {
    if (wasRunning.current && job && !job.running) {
      toast.success(t("outbox.gen.done", { created: job.created }));
      if (job.failed) toast.error(t("outbox.gen.failed", { n: job.failed, err: job.firstError ?? "?" }));
    }
    wasRunning.current = !!job?.running;
  }, [job, t]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const generate = () => run(async () => {
    const j = await api.post<GenerationJob>("/messaging/outbox/generate", { ...(campaignId ? { campaignId } : {}), limit: howMany });
    setJob(j);
    if (j.total === 0) toast.info(t("outbox.gen.none"));
  });
  const followUps = () => run(async () => {
    const r = await api.post<{ created: number }>("/messaging/outbox/followups/run", {});
    toast.success(t("outbox.gen.followupsDone", { n: r.created }));
  });
  const approve = (ids: string[]) => run(async () => {
    const r = await api.post<{ approved: number; rejected: { id: string; reason: string }[] }>("/messaging/outbox/approve", { ids });
    if (r.approved) toast.success(t("outbox.approved", { n: r.approved }));
    if (r.rejected.length) toast.error(t("outbox.rejectedN", { n: r.rejected.length, reason: r.rejected[0].reason }));
    setConfirmAll(false);
  });

  const tabCount = (k: Tab) => TAB_COUNT[k].reduce((n, s) => n + (counts[s] ?? 0), 0);
  const drafts = items?.filter((m) => m.status === "draft") ?? [];
  const progress = job && job.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t("outbox.title")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("outbox.intro")}</p>
      </header>

      {overview ? <WhatsappPanel overview={overview} refresh={load} /> : <div className="h-24 animate-pulse rounded-xl bg-muted/60" />}

      <div role="tablist" aria-label={t("outbox.title")} className="flex flex-wrap gap-1 border-b">
        {(Object.keys(TAB_STATUS) as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
              tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(`outbox.tab.${k}`)}
            <span className={cn("ml-2 rounded-full px-1.5 py-0.5 font-mono text-xs tabular-nums", k === "attention" && tabCount(k) > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>{tabCount(k)}</span>
          </button>
        ))}
      </div>

      {tab === "review" && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              {t("outbox.gen.campaign")}
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="mt-1 block h-9 min-w-[12rem] rounded-md border bg-background px-2 text-sm text-foreground">
                <option value="">{t("outbox.gen.all")}</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t("outbox.gen.count")}
              <Input type="number" min={1} max={200} value={howMany} onChange={(e) => setHowMany(Math.min(200, Math.max(1, Number(e.target.value) || 1)))} className="mt-1 h-9 w-24" />
            </label>
            <Button size="sm" disabled={busy || !!job?.running} onClick={generate}>
              {job?.running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("outbox.gen.write")}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={followUps} className="ml-auto">{t("outbox.gen.followups")}</Button>
          </div>
          {job?.running && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>{t("outbox.gen.progress", { done: job.done, total: job.total })}</span><span className="font-mono tabular-nums">{progress}%</span></div>
              <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
              <p className="mt-1.5 text-xs text-muted-foreground">{t("outbox.gen.slow")}</p>
            </div>
          )}
          {job && !job.running && job.total > 0 && (job.skipped.noValidPhone + job.skipped.duplicateNumber + job.skipped.optedOut) > 0 && (
            <p className="text-xs text-muted-foreground">{t("outbox.gen.skipped", { noPhone: job.skipped.noValidPhone, dup: job.skipped.duplicateNumber, opt: job.skipped.optedOut })}</p>
          )}
        </div>
      )}

      {tab === "review" && drafts.length > 1 && (
        <div className="flex justify-end">
          {confirmAll ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmAll(false)}>{t("outbox.cancel")}</Button>
              <Button size="sm" disabled={busy} onClick={() => approve(drafts.map((m) => m.id))}>{t("outbox.approveConfirm", { n: drafts.length })}</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setConfirmAll(true); setTimeout(() => setConfirmAll(false), 5000); }}>{t("outbox.approveAll", { n: drafts.length })}</Button>
          )}
        </div>
      )}

      {items === null ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/60" />)}</div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t(`outbox.empty.${tab}`)}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((m, i) => (
            <MessageCard key={m.id} m={m} position={tab === "queue" ? i + 1 : undefined} busy={busy}
              onApprove={(id) => approve([id])}
              onReject={(id) => run(async () => { await api.post("/messaging/outbox/reject", { ids: [id] }); })}
              onCancel={(id) => run(async () => { await api.post("/messaging/outbox/cancel", { ids: [id] }); })}
              onRetry={(id) => run(async () => { await api.post(`/messaging/outbox/${id}/retry`, {}); })}
              onSave={async (id, body) => { try { await api.patch(`/messaging/outbox/${id}`, { body }); await load(); } catch (e) { toast.error((e as Error).message); throw e; } }} />
          ))}
        </ul>
      )}
    </div>
  );
}
