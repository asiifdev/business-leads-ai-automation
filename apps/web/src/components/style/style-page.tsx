"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

/* Hallmark · component: page (AI Style) · genre: modern-minimal · theme: existing Prospex tokens
 * layout: workbench (voice profile rail + draft tester) · no new colours, no new fonts
 * pre-emit critique: P4 H4 E4 S4 R5 V4
 */

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
type Busy = "" | "inspect" | "train" | "draft";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const size = (b: number) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "?");

export function StylePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [inspected, setInspected] = useState<Inspected[] | null>(null);
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState<Busy>("");
  const [addMore, setAddMore] = useState(false);
  const [incoming, setIncoming] = useState("");
  const [result, setResult] = useState<{ draft: string; trace: Trace } | null>(null);

  const load = useCallback(() => {
    api.get<Profile | null>("/style/profile").then(setProfile).catch(() => setProfile(null)).finally(() => setLoaded(true));
  }, []);
  useEffect(load, [load]);

  const form = () => {
    const f = new FormData();
    files.forEach((file) => f.append("files", file));
    return f;
  };

  const pick = (list: File[]) => {
    const ok = list.filter((f) => /\.(txt|zip)$/i.test(f.name));
    if (ok.length !== list.length) toast.error("Only .txt and .zip exports are accepted");
    setFiles((prev) => [...prev, ...ok.filter((n) => !prev.some((p) => p.name === n.name && p.size === n.size))]);
    setInspected(null);
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
      setInspected(null); setFiles([]); setAddMore(false); setResult(null);
      toast.success("Style learned. Raw chats were not stored.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  };

  const draft = async () => {
    if (!incoming.trim() || busy) return;
    setBusy("draft");
    try { setResult(await api.post("/style/draft", { incoming })); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  };

  const forget = async () => {
    await api.delete("/style/profile");
    setProfile(null); setResult(null);
    toast.success("Style and examples deleted");
  };

  const showImporter = loaded && (!profile || addMore);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">AI Style</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Drafts that sound like you, built from your own WhatsApp exports. Only statistics and anonymized question-and-reply pairs are kept, never the raw chats.
            Nothing is sent without your approval.
          </p>
        </div>
        {profile && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddMore((v) => !v)}>{addMore ? "Cancel" : "Add more chats"}</Button>
            <Button variant="ghost" size="sm" onClick={forget} className="text-destructive hover:text-destructive"><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button>
          </div>
        )}
      </header>

      {!loaded && <div className="h-40 animate-pulse rounded-xl bg-muted/60" />}

      {showImporter && (
        <Importer files={files} pick={pick} remove={(i) => { setFiles((p) => p.filter((_, j) => j !== i)); setInspected(null); }}
          inspected={inspected} me={me} setMe={setMe} busy={busy} inspect={inspect} train={train} first={!profile} />
      )}

      {profile && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <VoiceProfile profile={profile} />
          <section aria-labelledby="try-title" className="min-w-0 space-y-5">
            <div>
              <h2 id="try-title" className="text-base font-semibold">Try a message</h2>
              <p className="text-sm text-muted-foreground">Paste what a customer wrote. The draft and the evidence behind it appear below.</p>
            </div>
            <div className="space-y-2">
              <Textarea
                value={incoming}
                onChange={(e) => setIncoming(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") draft(); }}
                placeholder="e.g. Kak, harga paket website berapa ya?"
                rows={3}
                aria-label="Customer message"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl/⌘ + Enter to draft</span>
                <Button onClick={draft} disabled={!incoming.trim() || busy !== ""} size="sm" className="ml-auto">
                  {busy === "draft" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {busy === "draft" ? "Writing…" : "Draft reply"}
                </Button>
              </div>
            </div>
            {result && <DraftResult r={result} />}
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------- Importer ---------- */

function Importer(props: {
  files: File[]; pick: (f: File[]) => void; remove: (i: number) => void; inspected: Inspected[] | null;
  me: string; setMe: (s: string) => void; busy: Busy; inspect: () => void; train: () => void; first: boolean;
}) {
  const { files, pick, remove, inspected, me, setMe, busy, inspect, train, first } = props;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const totals = new Map<string, number>();
  (inspected ?? []).flatMap((r) => r.senders).forEach((s) => totals.set(s.name, (totals.get(s.name) ?? 0) + s.messages));
  const senders = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const max = senders[0]?.[1] ?? 1;

  return (
    <section aria-label="Import chats" className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2">
      <div className="space-y-4 bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold">{first ? "Start with your chats" : "Add more chats"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            In WhatsApp open a chat, then <span className="text-foreground">More → Export chat → Without media</span>. Zip files work too. More conversations give a more accurate voice.
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(Array.from(e.dataTransfer.files)); }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
            over ? "border-primary bg-primary/5" : "border-border bg-background",
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="text-sm">Drop .txt or .zip exports here</p>
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>Choose files</Button>
          <input ref={input} type="file" multiple accept=".txt,.zip" className="sr-only" aria-label="Chat export files"
            onChange={(e) => { pick(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        </div>

        {files.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{size(f.size)}</span>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${f.name}`}
                  className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button onClick={inspect} disabled={!files.length || busy !== ""} size="sm" variant={inspected ? "outline" : "default"}>
          {busy === "inspect" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy === "inspect" ? "Reading…" : inspected ? "Read again" : "Read files"}
        </Button>
      </div>

      <div className="space-y-4 bg-card p-5 sm:p-6">
        {!inspected ? (
          <div className="flex h-full min-h-[10rem] flex-col justify-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Prospex reads the files and lists who wrote in them.</li>
              <li>You pick which one is you.</li>
              <li>Your replies become the voice. Their messages are used only as context.</li>
            </ol>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold">Which one is you?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {inspected.reduce((n, r) => n + r.messages, 0).toLocaleString()} messages across {inspected.length} {inspected.length === 1 ? "file" : "files"}
                {inspected[0]?.from && <> · {day(inspected.map((r) => r.from).filter(Boolean).sort()[0] ?? null)} to {day(inspected.map((r) => r.to).filter(Boolean).sort().at(-1) ?? null)}</>}
              </p>
            </div>
            <div role="radiogroup" aria-label="Your name in the chats" className="space-y-1.5">
              {senders.map(([name, n]) => {
                const on = me === name;
                return (
                  <button key={name} type="button" role="radio" aria-checked={on} onClick={() => setMe(name)}
                    className={cn(
                      "relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                      on ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                    )}>
                    <span aria-hidden className="absolute inset-y-0 left-0 bg-muted/70" style={{ width: `${(n / max) * 100}%`, opacity: on ? 0.5 : 1 }} />
                    <span className={cn("relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="relative min-w-0 flex-1 truncate font-medium">{name}</span>
                    <span className="relative font-mono text-xs tabular-nums text-muted-foreground">{n.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
            <Button onClick={train} disabled={!me || busy !== ""} size="sm">
              {busy === "train" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy === "train" ? "Learning… this can take a few minutes" : "Learn my style"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- Voice profile ---------- */

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct(value)}</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-muted" role="img" aria-label={`${label}: ${pct(value)}`}>
        <div className="h-full rounded-full bg-primary" style={{ width: pct(Math.min(1, value)) }} />
      </div>
    </div>
  );
}

function Words({ title, words }: { title: string; words: string[] }) {
  if (!words.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => <code key={w} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{w}</code>)}
      </div>
    </div>
  );
}

function VoiceProfile({ profile }: { profile: Profile }) {
  const s = profile.stats;
  return (
    <aside aria-label="Learned voice" className="space-y-5 lg:sticky lg:top-6 lg:self-start">
      <div>
        <div className="text-xs text-muted-foreground">Voice of</div>
        <div className="truncate text-lg font-semibold">{profile.ownerName}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{profile.messageCount.toLocaleString()}</span> messages ·{" "}
          <span className="font-mono tabular-nums">{profile.exampleCount.toLocaleString()}</span> reply examples · updated {day(profile.updatedAt)}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm">
        <div className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">Typical reply</dt>
          <dd className="mt-0.5"><span className="font-mono text-xl font-semibold tabular-nums">{Math.round(s.medianChars)}</span> <span className="text-xs text-muted-foreground">chars</span></dd>
        </div>
        <div className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">Average</dt>
          <dd className="mt-0.5"><span className="font-mono text-xl font-semibold tabular-nums">{Math.round(s.avgChars)}</span> <span className="text-xs text-muted-foreground">chars</span></dd>
        </div>
      </dl>

      <div className="space-y-3.5">
        <Meter label="Uses emoji" value={s.emojiRate} />
        <Meter label="Starts lowercase" value={s.lowercaseStartRate} />
        <Meter label="No final punctuation" value={s.noEndPunctuationRate} />
        <Meter label="Exclamation marks" value={s.exclamationRate} />
        <Meter label="Multi-line" value={s.multiLineRate} />
      </div>

      <div className="space-y-3.5">
        <Words title="Often opens with" words={s.topOpeners.slice(0, 6).map((o) => o.word)} />
        <Words title="Often ends with" words={s.topClosers.slice(0, 6).map((o) => o.word)} />
        <Words title="Favourite emoji" words={s.topEmoji.slice(0, 6).map((o) => o.emoji)} />
      </div>
    </aside>
  );
}

/* ---------- Draft + trace ---------- */

const confidenceTone: Record<string, string> = {
  high: "bg-success/15 text-success",
  low: "bg-warning/20 text-warning-foreground",
  none: "bg-muted text-muted-foreground",
};

function DraftResult({ r }: { r: { draft: string; trace: Trace } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(r.draft); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Could not copy"); }
  };
  const t = r.trace;

  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
      <figure className="rounded-xl border border-primary/40 bg-primary/5 p-4">
        <figcaption className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Draft · needs your approval before it is sent</span>
          <button type="button" onClick={copy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}
          </button>
        </figcaption>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{r.draft}</p>
      </figure>

      <div>
        <h3 className="text-sm font-semibold">How this draft was made</h3>
        <ol className="mt-3 space-y-5 border-l pl-5">
          <TraceStep title="Your habits applied" note="from your learned profile">
            <p className="text-sm text-muted-foreground">
              Replies around <span className="font-mono text-foreground">{Math.round(t.style.medianChars)}</span> chars,{" "}
              emoji in <span className="font-mono text-foreground">{pct(t.style.emojiRate)}</span> of messages,{" "}
              lowercase starts <span className="font-mono text-foreground">{pct(t.style.lowercaseStartRate)}</span>.
            </p>
          </TraceStep>

          <TraceStep title="Your real replies in similar situations" note={`${t.examples.length} used`}>
            {t.examples.length === 0 ? <p className="text-sm text-muted-foreground">No close match found.</p> : (
              <ul className="space-y-2">
                {t.examples.map((e, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm">
                    <div className="mb-2 flex items-center gap-2" title="Embedding similarity">
                      <div className="h-1 w-16 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: pct(Math.max(0, Math.min(1, e.similarity))) }} /></div>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{e.similarity.toFixed(2)}</span>
                    </div>
                    <p className="text-muted-foreground"><span className="mr-1.5 text-xs uppercase tracking-wide">Them</span>{e.incoming}</p>
                    <p className="mt-1"><span className="mr-1.5 text-xs uppercase tracking-wide text-primary">You</span>{e.reply}</p>
                  </li>
                ))}
              </ul>
            )}
          </TraceStep>

          <TraceStep title="Business facts found" note={
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", confidenceTone[t.knowledge.confidence] ?? confidenceTone.none)}>
              {t.knowledge.confidence} confidence
            </span>
          }>
            {t.knowledge.hits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in the knowledge base matched, so the model was told not to state prices or policies.</p>
            ) : (
              <ul className="space-y-2">
                {t.knowledge.hits.map((h, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{h.sourceTitle}</div>
                    <p className="mt-0.5 text-muted-foreground">{h.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </TraceStep>
        </ol>
        <p className="mt-4 font-mono text-xs text-muted-foreground">{t.model} · {(t.latencyMs / 1000).toFixed(1)}s</p>
      </div>
    </div>
  );
}

function TraceStep({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="relative">
      <span aria-hidden className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </li>
  );
}
