"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* Hallmark · component: panel (template broadcast) · genre: modern-minimal · theme: existing Prospex tokens
 * layout: one collapsible card, three numbered steps · no new colours or fonts
 */

interface Category { category: string; count: number; withPhone: number; withEmail: number }
interface LeadRow { id: string; name: string; category: string | null; contact: string | null; reachable: boolean; alreadyMessaged: boolean }
type Channel = "whatsapp" | "email";

export function TemplatePanel({ channel, onCreated }: { channel: Channel; onCreated: () => void }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [writing, setWriting] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) api.get<Category[]>("/messaging/templates/categories").then(setCats).catch(() => undefined);
  }, [open]);

  const loadLeads = useCallback(() => {
    const qs = new URLSearchParams({ channel, ...(category ? { category } : {}), ...(q.trim() ? { q: q.trim() } : {}), limit: "300" });
    api.get<LeadRow[]>(`/messaging/templates/leads?${qs}`).then((r) => { setLeads(r); setPicked(new Set()); }).catch((e: Error) => toast.error(e.message));
  }, [channel, category, q]);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(loadLeads, 250);
    return () => clearTimeout(id);
  }, [open, loadLeads]);

  const selectable = (leads ?? []).filter((l) => l.reachable && !l.alreadyMessaged);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const writeAi = async () => {
    if (!category) { toast.info(t("tpl.needCategory")); return; }
    setWriting(true);
    try {
      const r = await api.post<{ body: string; subject?: string; risks: string[] }>("/messaging/templates/generate", { segment: category, channel, language: lang === "id" ? "indonesian" : "english" });
      setBody(r.body);
      if (r.subject) setSubject(r.subject);
      if (r.risks.length) toast.info(t("tpl.aiRisk", { risks: r.risks.join(", ") }));
    } catch (e) { toast.error((e as Error).message); } finally { setWriting(false); }
  };

  const create = async () => {
    setCreating(true);
    try {
      const r = await api.post<{ created: number; skipped: { noContact: number; optedOut: number; alreadyMessaged: number } }>("/messaging/templates/apply", {
        channel, leadIds: [...picked], body, ...(channel === "email" ? { subject } : {}), language: lang === "id" ? "indonesian" : "english",
      });
      toast.success(t("tpl.created", { n: r.created }));
      const s = r.skipped;
      if (s.noContact + s.optedOut + s.alreadyMessaged > 0) toast.info(t("tpl.skipped", { noContact: s.noContact, opted: s.optedOut, already: s.alreadyMessaged }));
      setPicked(new Set());
      loadLeads();
      onCreated();
    } catch (e) { toast.error((e as Error).message); } finally { setCreating(false); }
  };

  const ready = picked.size > 0 && body.trim().length > 0 && (channel === "whatsapp" || subject.trim().length > 0);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-sm font-semibold">{t("tpl.title")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("tpl.intro")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{open ? t("tpl.close") : t("tpl.open")}</Button>
      </div>

      {open && (
        <div className="mt-4 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tpl.step1")}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted-foreground">
                {t("tpl.category")}
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block h-9 min-w-[14rem] rounded-md border bg-background px-2 text-sm text-foreground">
                  <option value="">{t("tpl.categoryAll")}</option>
                  {cats.filter((c) => c.category).map((c) => <option key={c.category} value={c.category}>{c.category} ({channel === "email" ? c.withEmail : c.withPhone}/{c.count})</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                {t("tpl.search")}
                <Input value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 h-9 w-52" />
              </label>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="tabular-nums text-muted-foreground">{t("tpl.selected", { n: picked.size })}</span>
                <Button size="sm" variant="outline" disabled={selectable.length === 0} onClick={() => setPicked(new Set(selectable.map((l) => l.id)))}>{t("tpl.selectAll", { n: selectable.length })}</Button>
                <Button size="sm" variant="ghost" disabled={picked.size === 0} onClick={() => setPicked(new Set())}>{t("tpl.clear")}</Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              {leads === null ? <div className="h-16 animate-pulse bg-muted/60" /> : leads.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">{t("tpl.noLeads")}</p>
              ) : (
                <ul className="divide-y text-sm">
                  {leads.map((l) => {
                    const off = !l.reachable || l.alreadyMessaged;
                    return (
                      <li key={l.id}>
                        <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50", off && "cursor-not-allowed opacity-50")}>
                          <input type="checkbox" disabled={off} checked={picked.has(l.id)} onChange={() => toggle(l.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                          <span className="min-w-0 flex-1 truncate">{l.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{l.alreadyMessaged ? t("tpl.alreadyMessaged") : !l.reachable ? t("tpl.noContact") : l.category}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tpl.step2")}</h3>
              <Button size="sm" variant="outline" disabled={writing} onClick={writeAi}>
                {writing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}{writing ? t("tpl.writing") : t("tpl.writeAi")}
              </Button>
            </div>
            {channel === "email" && (
              <label className="block text-xs text-muted-foreground">{t("tpl.subject")}
                <Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} className="mt-1 h-9" />
              </label>
            )}
            <label className="block text-xs text-muted-foreground">{t("tpl.body")}
              <Textarea value={body} rows={channel === "email" ? 10 : 6} maxLength={channel === "email" ? 4000 : 900} onChange={(e) => setBody(e.target.value)} className="mt-1" />
            </label>
            <p className="text-xs text-muted-foreground">{t("tpl.placeholders")}</p>
          </section>

          <section className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tpl.step3")}</h3>
            <Button disabled={!ready || creating} onClick={create}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("tpl.create", { n: picked.size })}
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
