"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { OutboxMessage } from "./types";

interface Props {
  m: OutboxMessage;
  position?: number;
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onSave: (id: string, body: string, subject?: string) => Promise<void>;
}

export function MessageCard({ m, position, busy, onApprove, onReject, onCancel, onRetry, onSave }: Props) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const [subject, setSubject] = useState(m.subject ?? "");
  const isEmail = m.channel === "email";
  const max = isEmail ? 4000 : 1000;
  const [saving, setSaving] = useState(false);
  const trace = m.context?.trace;
  const sourceKey = `outbox.src.${m.source}` as const;
  const followUp = m.source === "ai_followup" && m.context?.followUp ? ` #${m.context.followUp}` : "";

  const save = async () => {
    setSaving(true);
    try { await onSave(m.id, text, isEmail ? subject : undefined); setEditing(false); } finally { setSaving(false); }
  };

  return (
    <li className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          {m.lead ? <Link href={`/leads/${m.lead.id}`} className="font-medium hover:underline">{m.lead.name}</Link> : <span className="font-medium">{isEmail ? m.toEmail : `+${m.toPhone}`}</span>}
          <p className="text-xs text-muted-foreground">
            {[m.lead?.category, m.lead && `score ${m.lead.score}`].filter(Boolean).join(" · ")}
            {m.lead && " · "}<span className="font-mono tabular-nums">{isEmail ? m.toEmail : `+${m.toPhone}`}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {position !== undefined && <span className="font-mono tabular-nums">{t("outbox.queue.position", { n: position })}</span>}
          {m.status === "sent" && m.sentAt && <span>{t("outbox.sentAt", { time: new Date(m.sentAt).toLocaleString(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }) })}</span>}
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">{t(sourceKey)}{followUp}</span>
        </div>
      </div>

      {m.source === "ai_reply" && m.context?.incoming && (
        <blockquote className="mt-3 border-l-2 pl-3 text-sm text-muted-foreground">
          <span className="mr-1.5 text-xs uppercase tracking-wide">{t("outbox.theyWrote")}</span>{m.context.incoming}
        </blockquote>
      )}

      {m.context?.flagged && <p className="mt-2 rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">{t("outbox.flagged")}{!!m.context.risks?.length && <> <span className="font-medium">{m.context.risks.join(", ")}</span></>}</p>}

      {editing ? (
        <div className="mt-3 space-y-2">
          {isEmail && <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} aria-label={t("email.subject")} placeholder={t("email.subject")} />}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={isEmail ? 9 : 5} maxLength={max} aria-label={t("outbox.edit")} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{text.length}/{max}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setText(m.body); setSubject(m.subject ?? ""); setEditing(false); }}>{t("outbox.cancel")}</Button>
              <Button size="sm" disabled={saving || !text.trim() || (isEmail && !subject.trim())} onClick={save}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("outbox.save")}</Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {isEmail && m.subject && <p className="mt-3 text-sm font-medium">{m.subject}</p>}
          <p className={cn("whitespace-pre-wrap text-[15px] leading-relaxed", isEmail ? "mt-1.5" : "mt-3")}>{m.body}</p>
        </>
      )}

      {m.status === "failed" && m.error && <p className="mt-2 text-sm text-destructive">{m.error}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {trace && (trace.styled ? t("outbox.trace", { n: trace.examples, facts: trace.knowledge }) : t("outbox.trace.plain", { facts: trace.knowledge }))}
          {m.editedByUser && <span className={cn(trace && "ml-2")}>· {t("outbox.edited")}</span>}
        </p>
        <div className="flex items-center gap-2">
          {m.status === "draft" && !editing && (
            <>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReject(m.id)}>{t("outbox.reject")}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setText(m.body); setSubject(m.subject ?? ""); setEditing(true); }}>{t("outbox.edit")}</Button>
              <Button size="sm" disabled={busy} onClick={() => onApprove(m.id)}>{t("outbox.approve")}</Button>
            </>
          )}
          {m.status === "approved" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCancel(m.id)}>{t("outbox.remove")}</Button>}
          {m.status === "failed" && !/not on whatsapp|opted out|rejected this address|mailbox/i.test(m.error ?? "") && <Button size="sm" variant="outline" disabled={busy} onClick={() => onRetry(m.id)}>{t("outbox.retry")}</Button>}
        </div>
      </div>
    </li>
  );
}
