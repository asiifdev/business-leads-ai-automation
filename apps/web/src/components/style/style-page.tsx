"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Upload, Trash2, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

interface Inspected { file: string; messages: number; senders: { name: string; messages: number }[]; from: string | null; to: string | null; skippedLines: number }
interface Stats {
  messageCount: number; avgChars: number; medianChars: number; avgWords: number; emojiRate: number; exclamationRate: number;
  lowercaseStartRate: number; noEndPunctuationRate: number; multiLineRate: number;
  topOpeners: { word: string; count: number }[]; topClosers: { word: string; count: number }[]; topEmoji: { emoji: string; count: number }[];
}
interface Profile { ownerName: string; messageCount: number; exampleCount: number; stats: Stats; embeddingModel: string; updatedAt: string }
interface Trace {
  style: Stats; examples: { incoming: string; reply: string; similarity: number }[];
  knowledge: { confidence: string; hits: { sourceTitle: string; content: string; similarity: number }[] };
  model: string; latencyMs: number;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{n}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function StylePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [inspected, setInspected] = useState<Inspected[] | null>(null);
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState<"" | "inspect" | "train" | "draft">("");
  const [incoming, setIncoming] = useState("");
  const [result, setResult] = useState<{ draft: string; trace: Trace } | null>(null);

  const load = useCallback(() => {
    api.get<Profile | null>("/style/profile").then(setProfile).catch(() => setProfile(null));
  }, []);
  useEffect(load, [load]);

  const form = () => {
    const f = new FormData();
    files.forEach((file) => f.append("files", file));
    return f;
  };

  const inspect = async () => {
    setBusy("inspect");
    try {
      const res = await api.upload<Inspected[]>("/style/inspect", form());
      setInspected(res);
      const counts = new Map<string, number>();
      res.flatMap((r) => r.senders).forEach((s) => counts.set(s.name, (counts.get(s.name) ?? 0) + s.messages));
      setMe([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  };

  const train = async () => {
    setBusy("train");
    try {
      const f = form();
      f.append("me", me);
      setProfile(await api.upload<Profile>("/style/train", f));
      setInspected(null); setFiles([]);
      toast.success("Style learned. Raw chats were not stored.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  };

  const draft = async () => {
    setBusy("draft");
    try { setResult(await api.post("/style/draft", { incoming })); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  };

  const forget = async () => {
    await api.delete("/style/profile");
    setProfile(null); setResult(null);
    toast.success("Style and examples deleted");
  };

  const allSenders = [...new Set((inspected ?? []).flatMap((r) => r.senders.map((s) => s.name)))];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Sparkles className="h-6 w-6 text-primary" /> AI Style</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teach drafts to sound like you. Import your own WhatsApp chats (Chat → Export chat → Without media). Optional. Prospex keeps only statistics and anonymized
          question-and-reply examples, never the raw chats, and nothing is sent without your approval.
        </p>
      </div>

      <Step n={1} title="Import your chat exports">
        <input type="file" multiple accept=".txt,.zip" onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setInspected(null); }} className="block text-sm" />
        <Button onClick={inspect} disabled={!files.length || busy !== ""} variant="outline" size="sm">
          {busy === "inspect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Read files
        </Button>
        {inspected && (
          <div className="space-y-2 text-sm">
            {inspected.map((r) => (
              <div key={r.file} className="rounded-md border p-2">
                <div className="font-medium">{r.file}</div>
                <div className="text-muted-foreground">{r.messages} messages · {r.senders.map((s) => `${s.name} (${s.messages})`).join(", ")}</div>
              </div>
            ))}
          </div>
        )}
      </Step>

      {inspected && (
        <Step n={2} title="Which participant is you?">
          <select value={me} onChange={(e) => setMe(e.target.value)} className="w-full rounded-md border bg-background p-2 text-sm">
            {allSenders.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Button onClick={train} disabled={!me || busy !== ""} size="sm">
            {busy === "train" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Learn my style
          </Button>
        </Step>
      )}

      {profile && (
        <Step n={3} title="What was learned">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{profile.ownerName}</Badge>
            <Badge variant="secondary">{profile.messageCount} messages</Badge>
            <Badge variant="secondary">{profile.exampleCount} examples</Badge>
          </div>
          <StatsGrid s={profile.stats} />
          <Button onClick={forget} variant="ghost" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete learned style</Button>
        </Step>
      )}

      {profile && (
        <Step n={4} title="Try it: draft a reply">
          <Textarea value={incoming} onChange={(e) => setIncoming(e.target.value)} placeholder="Paste a customer message…" rows={3} />
          <Button onClick={draft} disabled={!incoming.trim() || busy !== ""} size="sm">
            {busy === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />} Draft reply
          </Button>
          {result && <TraceView r={result} />}
        </Step>
      )}
    </div>
  );
}

function StatsGrid({ s }: { s: Stats }) {
  const items = [
    ["Average reply", `${s.avgChars} chars (median ${s.medianChars})`],
    ["Emoji in", pct(s.emojiRate) + " of messages"],
    ["Start lowercase", pct(s.lowercaseStartRate)],
    ["No end punctuation", pct(s.noEndPunctuationRate)],
    ["Exclamation", pct(s.exclamationRate)],
    ["Multi-line", pct(s.multiLineRate)],
    ["Often opens with", s.topOpeners.slice(0, 4).map((o) => o.word).join(", ") || "-"],
    ["Often ends with", s.topClosers.slice(0, 4).map((o) => o.word).join(", ") || "-"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-md border p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>
      ))}
    </div>
  );
}

function TraceView({ r }: { r: { draft: string; trace: Trace } }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
        <div className="mb-1 text-xs font-medium text-primary">Draft (needs your approval before sending)</div>
        <div className="whitespace-pre-wrap">{r.draft}</div>
      </div>
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer font-medium">How this draft was made</summary>
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">1. Your writing habits applied</div>
            <StatsGrid s={r.trace.style} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">2. Your real replies in similar situations ({r.trace.examples.length})</div>
            {r.trace.examples.map((e, i) => (
              <div key={i} className="mt-1 rounded border p-2">
                <div className="text-xs text-muted-foreground">similarity {e.similarity}</div>
                <div>Customer: {e.incoming}</div>
                <div className="text-primary">You: {e.reply}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">3. Business facts found (confidence: {r.trace.knowledge.confidence})</div>
            {r.trace.knowledge.hits.length === 0 ? <div className="text-muted-foreground">None: the model was told not to state prices or policies.</div> :
              r.trace.knowledge.hits.map((h, i) => <div key={i} className="mt-1 rounded border p-2"><b>{h.sourceTitle}</b>: {h.content}</div>)}
          </div>
          <div className="text-xs text-muted-foreground">Model {r.trace.model} · {(r.trace.latencyMs / 1000).toFixed(1)}s</div>
        </div>
      </details>
    </div>
  );
}
