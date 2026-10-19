"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Clock, Loader2, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* Hallmark · component: page (Knowledge base) · genre: modern-minimal · theme: existing Prospex tokens
 * layout: add form + source list (one column) + test search panel · no new colours or fonts
 */

interface KnowledgeSource {
  id: string;
  title: string;
  kind: string | null;
  status: "ready" | "processing" | "error";
  chunkCount: number | null;
  error: string | null;
  createdAt: string;
}

interface SearchHit {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  similarity: number;
}

interface SearchResult {
  confidence: "high" | "low" | "none";
  hits: SearchHit[];
}

const KIND_OPTIONS = ["text", "pricing", "faq", "policy"] as const;

export function KnowledgePage() {
  const { t } = useI18n();
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);

  // add form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<string>("text");
  const [adding, setAdding] = useState(false);

  // delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // search
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.get<KnowledgeSource[]>("/knowledge/sources");
      setSources(list);
    } catch {
      toast.error(t("kb.error.load"));
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // Poll while any source is still processing
  useEffect(() => {
    if (!sources?.some((s) => s.status === "processing")) return;
    const id = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(id);
  }, [sources, load]);

  const handleAdd = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setAdding(true);
    try {
      await api.post("/knowledge/sources", { title: title.trim(), content: content.trim(), kind });
      toast.success(t("kb.saved"));
      setTitle(""); setContent(""); setKind("text"); setShowForm(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message || t("kb.error.add"));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("kb.source.delete.confirm"))) return;
    setDeletingId(id);
    try {
      await api.delete(`/knowledge/sources/${id}`);
      toast.success(t("kb.deleted"));
      setSources((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (err) {
      toast.error((err as Error).message || t("kb.error.delete"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSearch = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const r = await api.post<SearchResult>("/knowledge/search", { query: query.trim() });
      setSearchResult(r);
    } catch (err) {
      toast.error((err as Error).message || t("kb.error.search"));
    } finally {
      setSearching(false);
    }
  };

  const statusIcon = (s: KnowledgeSource) => {
    if (s.status === "ready") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    if (s.status === "processing") return <Clock className="h-3.5 w-3.5 animate-pulse text-amber-500" />;
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  const statusLabel = (s: KnowledgeSource) =>
    t(s.status === "ready" ? "kb.source.status.ready" : s.status === "processing" ? "kb.source.status.processing" : "kb.source.status.error");

  const confidenceTone = (c: "high" | "low" | "none") =>
    c === "high" ? "success" : c === "low" ? "warning" : ("secondary" as const);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("kb.title")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("kb.subtitle")}</p>
      </header>

      {/* Add form */}
      {!showForm ? (
        <Button onClick={() => setShowForm(true)} size="sm">
          <BookOpen className="mr-2 h-4 w-4" />{t("kb.add")}
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={(e) => { void handleAdd(e); }} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("kb.add.title")}</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("kb.add.titlePlaceholder")}
                    maxLength={200}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("kb.add.kind")}</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>{t(`kb.add.kind.${k}` as Parameters<typeof t>[0])}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("kb.add.content")}</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("kb.add.contentPlaceholder")}
                  rows={8}
                  className="resize-y font-mono text-xs"
                  required
                />
                <p className="text-right text-xs text-muted-foreground tabular-nums">{content.length.toLocaleString()} / 200,000</p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={adding || !title.trim() || !content.trim()}>
                  {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("kb.add.submit")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowForm(false); setTitle(""); setContent(""); setKind("text"); }}>
                  {t("kb.add.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Source list */}
      {sources === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />)}
        </div>
      ) : sources.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("kb.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-sm">{s.title}</span>
                  {s.kind && s.kind !== "text" && (
                    <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">{s.kind}</Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {statusIcon(s)}
                  <span>{statusLabel(s)}</span>
                  {s.status === "ready" && s.chunkCount !== null && (
                    <span className="tabular-nums">· {s.chunkCount} {s.chunkCount === 1 ? t("kb.source.chunks") : t("kb.source.chunks_plural")}</span>
                  )}
                  {s.status === "error" && s.error && (
                    <span className="text-destructive truncate max-w-[20rem]" title={s.error}>· {s.error}</span>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                disabled={deletingId === s.id}
                aria-label={t("kb.source.delete")}
                onClick={() => { void handleDelete(s.id); }}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Test search */}
      {sources !== null && sources.some((s) => s.status === "ready") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("kb.search")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={(e) => { void handleSearch(e); }} className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("kb.search.placeholder")}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={searching || !query.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">{t("kb.search.run")}</span>
              </Button>
            </form>

            {searchResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t("kb.search.confidence")}:</span>
                  <Badge variant={confidenceTone(searchResult.confidence)}>{t(`kb.search.confidence.${searchResult.confidence}` as Parameters<typeof t>[0])}</Badge>
                </div>
                {searchResult.hits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("kb.search.noResults")}</p>
                ) : (
                  <ul className="space-y-2">
                    {searchResult.hits.map((h) => (
                      <li key={h.chunkId} className={cn("rounded-lg border px-3 py-2.5 text-xs", "bg-muted/30")}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{h.sourceTitle}</span>
                          <span className="tabular-nums text-muted-foreground">{Math.round(h.similarity * 100)}%</span>
                        </div>
                        <p className="line-clamp-3 text-muted-foreground leading-relaxed">{h.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
