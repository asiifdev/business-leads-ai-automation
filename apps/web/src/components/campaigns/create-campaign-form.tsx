"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { countryOptions } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { SourceMaterial } from "@/components/marketing/source-material";
import { hasBrief, type Brief, type BriefResponse } from "@/components/marketing/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
import { briefIsRunning, generateBrief, waitForBrief } from "@/lib/generate-brief";

export function CreateCampaignForm() {
  const { t, lang } = useI18n();
  const countries = useMemo(() => countryOptions(lang), [lang]);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [queries, setQueries] = useState<string[]>([""]);
  const [sources, setSources] = useState<string[]>(["google_maps"]);
  // source material and AI autofill
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [pass, setPass] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  /** Fields the AI filled and the user has not changed: shown with a badge. A field the user edited is never overwritten. */
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [noteOpen, setNoteOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    location: "",
    country: "ID",
    yourService: "",
    maxResults: "20",
    contentStyle: "balanced",
    language: "indonesian",
  });

  const mark = (k: string) => {
    setTouched((p) => new Set(p).add(k));
    setAiFilled((p) => { const n = new Set(p); n.delete(k); return n; });
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    mark(k);
    setForm((p) => ({ ...p, [k]: e.target.value }));
  };
  const pick = (k: keyof typeof form) => (v: string) => { mark(k); setForm((p) => ({ ...p, [k]: v })); };

  useEffect(() => {
    api.get<BriefResponse>("/marketing/brief").then((b) => { if (hasBrief(b)) setBrief(b); }).catch(() => undefined);
  }, []);

  /** Fills every field the person has not touched from a brief's campaign suggestion. */
  const applyBrief = (b: Brief) => {
    setBrief(b);
    const c = b.campaign;
    const filled = new Set<string>();
    const free = (k: string) => !touched.has(k);
    setForm((p) => {
      const n = { ...p };
      if (c?.name && free("name")) { n.name = c.name; filled.add("name"); }
      if (c?.target && free("industry")) { n.industry = c.target; filled.add("industry"); }
      if (c?.location && free("location")) { n.location = c.location; filled.add("location"); }
      if (b.summary && free("yourService")) { n.yourService = b.summary; filled.add("yourService"); }
      if (c?.contentStyle && free("contentStyle")) { n.contentStyle = c.contentStyle; filled.add("contentStyle"); }
      if (c?.language && free("language")) { n.language = c.language; filled.add("language"); }
      return n;
    });
    if (c?.searchQueries?.length && free("queries")) { setQueries(c.searchQueries); filled.add("queries"); }
    setAiFilled(filled);
  };

  const analyze = async (resume = false) => {
    setAnalyzing(true);
    try {
      const b = resume ? await waitForBrief<Brief>(setPass) : await generateBrief<Brief>({
        sourceIds: selected.length ? selected : undefined,
        notes: [notes, !touched.has("yourService") ? "" : form.yourService].filter(Boolean).join("\n\n") || undefined,
        industry: touched.has("industry") ? form.industry || undefined : undefined,
        location: touched.has("location") ? form.location || undefined : undefined,
        language: form.language === "english" ? "english" : "indonesian",
      }, setPass);
      applyBrief(b);
      toast.success(t("mkt.gen.done"));
    } catch (e) {
      toast.error(t("mkt.gen.failed", { err: (e as Error).message }));
    } finally {
      setAnalyzing(false);
      setPass("");
    }
  };
  // coming back to the page while an analysis is still running: pick it up instead of starting another
  useEffect(() => {
    void briefIsRunning().then((r) => { if (r) void analyze(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const badge = (k: string) => aiFilled.has(k) && (
    <span title={t("mkt.ai.badge")} className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-px text-[10px] font-semibold text-primary">
      <Sparkles className="h-2.5 w-2.5" aria-hidden />AI<span className="sr-only"> {t("mkt.ai.badge")}</span>
    </span>
  );
  const segments = brief ? [...new Set(brief.content.angles.map((a) => a.segment.trim()))].filter((x) => x && x.length <= 40).slice(0, 4) : [];

  const addQuery = () => setQueries((q) => [...q, ""]);
  const removeQuery = (i: number) => { mark("queries"); setQueries((q) => q.filter((_, idx) => idx !== i)); };
  const updateQuery = (i: number, v: string) => { mark("queries"); setQueries((q) => q.map((old, idx) => (idx === i ? v : old))); };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const campaign = await api.post<{ id: string }>("/campaigns", {
        name: form.name,
        industry: form.industry,
        location: form.location,
        country: form.country,
        searchQueries: queries.filter(Boolean),
        sources,
        yourService: form.yourService,
        maxResults: Number(form.maxResults),
        contentStyle: form.contentStyle,
        language: form.language,
      });
      await api.post(`/scraper/campaigns/${campaign.id}/start`, {});
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      console.error("Failed to create campaign:", err);
      setLoading(false);
    }
  };

  const canAnalyze = selected.length > 0 || notes.trim().length >= 30 || touched.has("yourService");
  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-4">
        <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby="src-title">
          <div>
            <h2 id="src-title" className="text-base font-semibold">{t("mkt.src.title")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("mkt.src.intro")}</p>
          </div>
          <SourceMaterial selected={selected} onSelected={setSelected} />
          {noteOpen ? (
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("mkt.gen.notes")}</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("mkt.gen.notesPh")} rows={3} className="resize-none" />
            </div>
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
              <Plus className="h-3.5 w-3.5" />{t("mkt.gen.notes")}
            </button>
          )}
          <div className="space-y-2">
            {brief?.campaign && (
              <Button type="button" className="w-full" onClick={() => { applyBrief(brief); toast.success(t("mkt.gen.filledFromBrief")); }}>
                <Sparkles className="mr-2 h-4 w-4" />{t("mkt.gen.fromBrief")}
              </Button>
            )}
            <Button type="button" variant={brief?.campaign ? "outline" : "default"} className="w-full" onClick={() => void analyze()} disabled={analyzing || !canAnalyze}>
              {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {analyzing ? (pass ? t("mkt.gen.stage", { n: ["positioning", "evidence", "outreach"].indexOf(pass) + 1 }) : t("mkt.gen.running")) : t("mkt.gen.button")}
            </Button>
            {!canAnalyze && <p className="text-xs text-muted-foreground">{t("mkt.gen.needSource")}</p>}
          </div>
        </section>

        {brief && aiFilled.size > 0 && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm" aria-live="polite">
            <p className="font-medium">{t("mkt.gen.done")}</p>
            <p className="mt-1 text-muted-foreground">{brief.pagesRead.length > 0 ? t("mkt.gen.basedOn", { pages: brief.pagesRead.length, sources: brief.sources.length }) : t("mkt.gen.basedOnSources", { sources: brief.sources.length })}</p>
            {brief.content.gaps.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium">{t("mkt.gen.gaps")}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">{brief.content.gaps.slice(0, 4).map((g) => <li key={g}>{g.replace(/^\[NEED:\s*/i, "").replace(/\]$/, "")}</li>)}</ul>
              </div>
            )}
            <Link href="/brief" className="mt-3 inline-block text-primary hover:underline">{t("mkt.gen.viewBrief")}</Link>
          </section>
        )}
      </aside>

      <div className="space-y-8">
        <fieldset className="space-y-4 border-b pb-8">
          <legend className="mb-1 text-sm font-semibold">{t("camp.group.who")}</legend>
          <div className="space-y-2">
            <Label htmlFor="name">{t("camp.form.name")}{badge("name")}</Label>
            <Input id="name" placeholder={t("camp.form.namePh")} value={form.name} onChange={set("name")} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">{t("camp.form.industry")}{badge("industry")}</Label>
              <Input id="industry" placeholder={t("camp.form.industryPh")} value={form.industry} onChange={set("industry")} required />
              {segments.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-xs text-muted-foreground">{t("mkt.form.segments")}</span>
                  {segments.map((seg) => (
                    <button key={seg} type="button" onClick={() => pick("industry")(seg)} className="rounded-md bg-muted px-2 py-0.5 text-xs hover:bg-muted/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{seg}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("camp.form.country")}</Label>
              <select id="country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{t("camp.form.countryHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t("camp.form.location")}{badge("location")}</Label>
              <Input id="location" placeholder={t("camp.form.locationPh")} value={form.location} onChange={set("location")} required />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("camp.form.queries")}{badge("queries")}</Label>
              <span className="text-xs text-muted-foreground">{t(queries.length === 1 ? "camp.form.queryCountOne" : "camp.form.queryCountMany", { n: queries.length })}</span>
            </div>
            <div className="space-y-2">
              {queries.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    data-testid="query-input"
                    placeholder={t("camp.form.queryPh", { industry: form.industry || "restaurant", location: form.location || "Jakarta" })}
                    value={q}
                    onChange={(e) => updateQuery(i, e.target.value)}
                    required
                  />
                  {queries.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuery(i)} aria-label={t("camp.form.removeQuery")} className="flex-shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addQuery} className="-ml-2 text-xs text-muted-foreground">
              <Plus className="mr-1 h-3 w-3" />{t("camp.form.addQuery")}
            </Button>
          </div>
        </fieldset>

        <fieldset className="space-y-3 border-b pb-8">
          <legend className="mb-1 text-sm font-semibold">{t("camp.group.offer")}</legend>
          <div className="flex items-center justify-between">
            <Label htmlFor="service">{t("camp.form.service")}{badge("yourService")}</Label>
            {brief && brief.summary !== form.yourService && (
              <button type="button" onClick={() => pick("yourService")(brief.summary)} className="text-xs text-primary hover:underline">{t("mkt.form.useSummary")}</button>
            )}
          </div>
          <Textarea id="service" placeholder={t("camp.form.servicePh")} value={form.yourService} onChange={set("yourService")} className="resize-y" rows={4} required />
        </fieldset>

        <fieldset className="space-y-3 border-b pb-8">
          <legend className="mb-1 text-sm font-semibold">{t("camp.src.title")}</legend>
          {(["google_maps", "osm", "overture"] as const).map((s) => (
            <label key={s} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={sources.includes(s)}
                onChange={(e) => setSources((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))}
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <span>
                <span className="font-medium">{t(`camp.src.${s}` as MessageKey)}</span>
                <span className="block text-xs text-muted-foreground">{t(`camp.src.${s === "osm" ? "osmDesc" : s === "overture" ? "overtureDesc" : "google_mapsDesc"}` as MessageKey)}</span>
              </span>
            </label>
          ))}
          {sources.includes("osm") && <p className="text-xs text-muted-foreground">{t("camp.src.osmHint")}</p>}
          {sources.includes("overture") && <p className="text-xs text-muted-foreground">{t("camp.src.overtureHint")}</p>}
          {sources.length === 0 && <p role="alert" className="text-xs text-destructive">{t("camp.src.atLeastOne")}</p>}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-semibold">{t("camp.group.how")}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("camp.form.maxResults")}</Label>
              <Select value={form.maxResults} onValueChange={(v) => setForm((p) => ({ ...p, maxResults: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "20", "50", "100", "250", "500", "1000", "1500"].map((n) => (
                    <SelectItem key={n} value={n}>{t("camp.form.leadsCount", { n })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("camp.form.contentStyle")}{badge("contentStyle")}</Label>
              <Select value={form.contentStyle} onValueChange={pick("contentStyle")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">{t("camp.style.professional")}</SelectItem>
                  <SelectItem value="friendly">{t("camp.style.friendly")}</SelectItem>
                  <SelectItem value="balanced">{t("camp.style.balanced")}</SelectItem>
                  <SelectItem value="casual">{t("camp.style.casual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("camp.form.language")}{badge("language")}</Label>
              <Select value={form.language} onValueChange={pick("language")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indonesian">{t("camp.lang.indonesian")}</SelectItem>
                  <SelectItem value="english">{t("camp.lang.english")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <Button type="button" variant="ghost" onClick={() => router.back()}>{t("camp.form.cancel")}</Button>
          <Button type="submit" disabled={loading || sources.length === 0}>
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("camp.form.starting")}</>) : t("camp.form.start")}
          </Button>
        </div>
      </div>
    </form>
  );
}
