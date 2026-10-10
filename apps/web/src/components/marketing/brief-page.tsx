"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BriefSections } from "./brief-sections";
import { SourceMaterial } from "./source-material";
import { hasBrief, type Brief, type BriefResponse } from "./types";

/* Hallmark · component: page (Marketing Brief) · genre: modern-minimal · theme: existing Prospex tokens
 * layout: one reading column; sources and generate first, then the brief as plain sections
 */
export function BriefPage() {
  const { t, lang } = useI18n();
  const [brief, setBrief] = useState<Brief | null | undefined>(undefined);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");

  const load = useCallback(async () => {
    try {
      const b = await api.get<BriefResponse>("/marketing/brief");
      if (hasBrief(b)) { setBrief(b); setSummary(b.summary); setSelected((cur) => (cur.length ? cur : b.sources.map((s) => s.id))); }
      else setBrief(null);
    } catch { setBrief(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const b = await api.post<Brief>("/marketing/brief/generate", { sourceIds: selected.length ? selected : undefined, notes: notes || undefined, language: lang === "id" ? "indonesian" : "english" });
      setBrief(b);
      setSummary(b.summary);
    } catch (e) { toast.error(t("mkt.gen.failed", { err: (e as Error).message })); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!brief) return;
    setBusy(true);
    try {
      const b = await api.put<Brief>("/marketing/brief", { summary, content: brief.content });
      setBrief(b);
      toast.success(t("mkt.brief.saved"));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const canGenerate = selected.length > 0 || notes.trim().length >= 30;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("mkt.brief.title")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("mkt.brief.intro")}</p>
      </header>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-label={t("mkt.src.title")}>
        <h2 className="text-base font-semibold">{t("mkt.src.title")}</h2>
        <SourceMaterial selected={selected} onSelected={setSelected} />
        <div className="space-y-1.5">
          <Label htmlFor="brief-notes">{t("mkt.gen.notes")}</Label>
          <Textarea id="brief-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("mkt.gen.notesPh")} rows={2} className="resize-none" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={busy || !canGenerate}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {busy ? t("mkt.gen.running") : brief ? t("mkt.brief.regenerate") : t("mkt.brief.generate")}
          </Button>
          {!canGenerate && <span className="text-xs text-muted-foreground">{t("mkt.gen.needSource")}</span>}
        </div>
      </section>

      {brief === undefined ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      ) : brief === null ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("mkt.brief.empty")}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("mkt.brief.version", { n: brief.version, date: new Date(brief.updatedAt).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium" }) })}</p>

          <section className="space-y-2">
            <Label htmlFor="brief-summary">{t("mkt.brief.summary")}</Label>
            <Textarea id="brief-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} maxLength={600} />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{summary.length}/600</span>
              <Button size="sm" variant="outline" disabled={busy || summary.trim().length < 10 || summary === brief.summary} onClick={save}>{t("mkt.brief.save")}</Button>
            </div>
          </section>

          <BriefSections content={brief.content} />

          {brief.pagesRead.length > 0 && (
            <details className="rounded-xl border bg-card p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold">{t("mkt.brief.pagesRead", { n: brief.pagesRead.length })}</summary>
              <ul className="mt-3 space-y-1 text-sm">
                {brief.pagesRead.map((p) => (
                  <li key={p.url} className="truncate"><a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.title || p.url}</a> <span className="text-xs text-muted-foreground">{p.url}</span></li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
