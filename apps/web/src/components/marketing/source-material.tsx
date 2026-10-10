"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Globe, Loader2, TextCursorInput, Trash2, Upload, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Source } from "./types";

type Tab = "url" | "text" | "file";

/**
 * Where the AI learns about the product: websites, pasted text, .md/.txt files. Websites are read in the background
 * (the whole site through its sitemap and llms.txt), so this list polls while anything is still being read.
 */
export function SourceMaterial({ selected, onSelected, onLoaded }: { selected: string[]; onSelected: (ids: string[]) => void; onLoaded?: (sources: Source[]) => void }) {
  const { t, lang } = useI18n();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.get<Source[]>("/marketing/sources");
      setSources(list);
      onLoaded?.(list);
      // sources that appear after the first load were added by the user in this session: select them once they are readable
      if (known.current === null) known.current = new Set(list.map((s) => s.id));
    } catch { /* keep the previous list */ }
  }, [onLoaded]);

  useEffect(() => { void load(); }, [load]);

  const working = sources?.some((s) => s.status === "processing" && !s.readable) || sources?.some((s) => !!s.progress);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) void load(); }, working ? 2500 : 15000);
    return () => clearInterval(id);
  }, [load, working]);

  // auto-select what the user just added, as soon as it can be read
  useEffect(() => {
    if (!sources || !known.current) return;
    const fresh = sources.filter((s) => !known.current!.has(s.id) && s.readable);
    if (fresh.length) {
      fresh.forEach((s) => known.current!.add(s.id));
      onSelected([...new Set([...selected, ...fresh.map((s) => s.id)])]);
    }
  }, [sources, selected, onSelected]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const addUrl = () => run(async () => { await api.post("/marketing/sources/url", { url: url.trim() }); setUrl(""); });
  const addText = () => run(async () => { await api.post("/marketing/sources/text", { title: title.trim() || "Notes", content: text }); setTitle(""); setText(""); toast.success(t("mkt.src.added")); });
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    void run(() => api.upload("/marketing/sources/file", form));
  };
  const remove = (id: string) => run(async () => { await api.delete(`/marketing/sources/${id}`); onSelected(selected.filter((x) => x !== id)); });
  const toggle = (id: string) => onSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const state = (s: Source) => {
    if (s.status === "failed") return { text: s.error || t("mkt.src.state.failed"), tone: "text-destructive" as const, icon: AlertCircle };
    if (s.progress?.stage === "indexing") return { text: t("mkt.src.state.indexing", { pages: s.progress.pages ?? 0, found: s.progress.discovered ?? 0 }), tone: "text-muted-foreground" as const, icon: Loader2 };
    if (s.status === "processing" && !s.readable) return { text: t("mkt.src.state.reading"), tone: "text-muted-foreground" as const, icon: Loader2 };
    return { text: s.pages > 0 ? t("mkt.src.state.pages", { pages: s.pages }) : t("mkt.src.state.ready"), tone: "text-muted-foreground" as const, icon: Check };
  };

  const tabs: { key: Tab; label: string; icon: typeof Globe }[] = [
    { key: "url", label: t("mkt.src.tab.url"), icon: Globe },
    { key: "text", label: t("mkt.src.tab.text"), icon: TextCursorInput },
    { key: "file", label: t("mkt.src.tab.file"), icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 border-b">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === "url" && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("mkt.src.urlPh")} aria-label={t("mkt.src.tab.url")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (url.trim() && !busy) void addUrl(); } }} />
            <Button type="button" onClick={addUrl} disabled={busy || url.trim().length < 4}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("mkt.src.read")}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("mkt.src.urlHelp")}</p>
        </div>
      )}
      {tab === "text" && (
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("mkt.src.textTitlePh")} maxLength={120} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("mkt.src.textPh")} rows={5} className="resize-y" />
          <Button type="button" onClick={addText} disabled={busy || text.trim().length < 30}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("mkt.src.add")}</Button>
        </div>
      )}
      {tab === "file" && (
        <div className="space-y-1.5">
          <input ref={picker} type="file" accept=".pdf,.docx,.md,.markdown,.txt" multiple className="sr-only" aria-label={t("mkt.src.tab.file")} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <Button type="button" variant="outline" onClick={() => picker.current?.click()} disabled={busy}><Upload className="mr-2 h-4 w-4" />{t("mkt.src.choose")}</Button>
          <p className="text-xs text-muted-foreground">{t("mkt.src.fileHelp")}</p>
        </div>
      )}

      {sources === null ? (
        <div className="h-12 animate-pulse rounded-lg bg-muted/60" />
      ) : sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("mkt.src.empty")}</p>
      ) : (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">{t("mkt.src.saved")}</p>
        <ul className="divide-y rounded-lg border">
          {sources.map((s) => {
            const st = state(s);
            const Icon = st.icon;
            const Kind = s.kind === "url" ? Globe : s.kind === "file" ? FileText : TextCursorInput;
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} disabled={!s.readable} aria-label={s.title}
                  className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
                <Kind className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{shownTitle(s)}</div>
                  <div className={cn("flex items-center gap-1 truncate text-xs", st.tone)}>
                    <Icon className={cn("h-3 w-3 shrink-0", Icon === Loader2 && "animate-spin")} />{st.text}
                    <span className="text-muted-foreground">· {t("mkt.src.addedOn", { date: new Date(s.createdAt).toLocaleString(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium" }) })}</span>
                  </div>
                </div>
                <button type="button" onClick={() => remove(s.id)} aria-label={`${t("mkt.src.remove")}: ${s.title}`}
                  className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
        </div>
      )}
    </div>
  );
}

/** A website is named by its host: older rows were titled after the first page they read ("llms.txt"). */
function shownTitle(s: Source): string {
  if (s.kind === "url" && s.url) {
    try { return new URL(s.url).hostname; } catch { /* keep the stored title */ }
  }
  return s.title;
}
