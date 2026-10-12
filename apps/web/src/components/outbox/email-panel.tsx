"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pause, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { EmailOverview } from "./types";

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="min-w-[8rem]">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-foreground">{used}/{limit}</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-muted"><div className={cn("h-full rounded-full", pct >= 100 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function EmailPanel({ overview, refresh }: { overview: EmailOverview; refresh: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const a = overview.account;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const label = !a ? t("email.status.none") : a.status === "ready" ? t("email.status.ready", { from: a.fromEmail }) : a.status === "error" ? t("email.status.error") : t("email.status.untested");
  const dot = !a ? "bg-muted-foreground/50" : a.status === "ready" ? (a.paused ? "bg-warning" : "bg-success") : a.status === "error" ? "bg-destructive" : "bg-info";

  return (
    <section aria-label={t("email.title")} className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium"><span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />{label}</div>
          {a?.paused && a.status === "ready" && <p className="mt-0.5 text-xs text-warning">{t("outbox.wa.paused")}</p>}
          {a?.lastError && <p className="mt-0.5 max-w-md text-xs text-destructive">{a.lastError}</p>}
          {!a && <p className="mt-0.5 max-w-md text-xs text-muted-foreground">{t("email.setupHint")}</p>}
        </div>
        {a?.status === "ready" && (
          <div className="flex flex-wrap gap-6">
            <Usage label={t("outbox.wa.thisHour")} used={overview.usage.sentLastHour} limit={a.hourlyLimit} />
            <Usage label={t("outbox.wa.today")} used={overview.usage.sentToday} limit={a.dailyLimit} />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!a && <Button size="sm" onClick={() => setOpen(true)}>{t("email.setup")}</Button>}
          {a && a.status !== "ready" && (
            <Button size="sm" disabled={busy} onClick={() => act(() => api.post("/email/account/test", {}))}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("email.test")}
            </Button>
          )}
          {a?.status === "ready" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api.put("/email/account", { ...accountBody(a), paused: !a.paused }))}>
              {a.paused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}{a.paused ? t("outbox.wa.resume") : t("outbox.wa.pause")}
            </Button>
          )}
          {a && <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><SlidersHorizontal className="mr-1.5 h-4 w-4" />{t("outbox.wa.settings")}</Button>}
        </div>
      </div>
      {!overview.unsubscribeReady && <p className="border-t border-destructive/40 bg-destructive/5 px-4 py-2.5 text-xs sm:px-5">{t("email.unsubscribeNotReady")}</p>}
      {overview.quietNow && a?.status === "ready" && <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">{t("outbox.wa.quiet", { end: String(a.quietEndHour).padStart(2, "0") })}</p>}
      {a?.status === "ready" && overview.usage.approved > 0 && !!overview.etaHours && <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">{t("outbox.wa.eta", { hours: overview.etaHours })}</p>}
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">{t("email.note")}</p>
      <AccountDialog open={open} onClose={() => setOpen(false)} overview={overview} refresh={refresh} />
    </section>
  );
}

type Account = NonNullable<EmailOverview["account"]>;
function accountBody(a: Account) {
  return { host: a.host, port: a.port, secure: a.secure, username: a.username, fromName: a.fromName, fromEmail: a.fromEmail, ...(a.replyTo ? { replyTo: a.replyTo } : {}), postalAddress: a.postalAddress, ...(a.ctaUrl ? { ctaUrl: a.ctaUrl } : {}), hourlyLimit: a.hourlyLimit, dailyLimit: a.dailyLimit, quietStartHour: a.quietStartHour, quietEndHour: a.quietEndHour, timezone: a.timezone };
}

const EMPTY = { host: "", port: 587, secure: false, username: "", password: "", fromName: "", fromEmail: "", replyTo: "", postalAddress: "", ctaUrl: "", hourlyLimit: 8, dailyLimit: 40, quietStartHour: 20, quietEndHour: 7, timezone: "Asia/Jakarta" };

function AccountDialog({ open, onClose, overview, refresh }: { open: boolean; onClose: () => void; overview: EmailOverview; refresh: () => void }) {
  const { t } = useI18n();
  const a = overview.account;
  const initial = a ? { ...accountBody(a), replyTo: a.replyTo ?? "", password: "" } : EMPTY;
  const [v, setV] = useState<typeof EMPTY>(initial as typeof EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setV(initial as typeof EMPTY); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const text = (k: "host" | "username" | "fromName" | "fromEmail" | "replyTo" | "ctaUrl" | "timezone", label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`e-${k}`}>{label}</Label>
      <Input id={`e-${k}`} type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} autoComplete="off" />
    </div>
  );
  const num = (k: "port" | "hourlyLimit" | "dailyLimit" | "quietStartHour" | "quietEndHour", label: string, min: number, max: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={`e-${k}`}>{label}</Label>
      <Input id={`e-${k}`} type="number" min={min} max={max} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
    </div>
  );
  const save = async () => {
    setBusy(true);
    try {
      const { password, replyTo, ...rest } = v;
      await api.put("/email/account", { ...rest, ...(password ? { password } : {}), ...(replyTo.trim() ? { replyTo: replyTo.trim() } : {}) });
      toast.success(t("email.saved"));
      onClose(); refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete("/email/account"); onClose(); refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{t("email.dialog.title")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("host", t("email.host"))}
          {num("port", t("email.port"), 1, 65535)}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={v.secure} onChange={(e) => setV({ ...v, secure: e.target.checked })} className="h-4 w-4" />
            {t("email.secure")}
          </label>
          {text("username", t("email.username"))}
          <div className="space-y-1.5">
            <Label htmlFor="e-password">{t("email.password")}</Label>
            <Input id="e-password" type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="new-password" placeholder={a?.hasPassword ? t("email.passwordKeep") : ""} />
          </div>
          {text("fromName", t("email.fromName"))}
          {text("fromEmail", t("email.fromEmail"), "email")}
          {text("replyTo", t("email.replyTo"), "email")}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="e-address">{t("email.address")}</Label>
            <Textarea id="e-address" rows={2} maxLength={300} value={v.postalAddress} onChange={(e) => setV({ ...v, postalAddress: e.target.value })} />
            <p className="text-xs text-muted-foreground">{t("email.addressHint")}</p>
          </div>
          {text("ctaUrl", t("email.ctaUrl"), "url")}
          {num("hourlyLimit", t("outbox.set.hourly"), 1, 30)}
          {num("dailyLimit", t("outbox.set.daily"), 1, 200)}
          {num("quietStartHour", t("outbox.set.quietStart"), 0, 23)}
          {num("quietEndHour", t("outbox.set.quietEnd"), 0, 23)}
          {text("timezone", t("outbox.set.tz"))}
        </div>
        <p className="text-xs text-muted-foreground">{t("email.passwordHint")}</p>
        <div className="flex items-center justify-between gap-2">
          {a ? <Button variant="ghost" size="sm" disabled={busy} onClick={remove} className="text-destructive">{t("email.remove")}</Button> : <span />}
          <Button disabled={busy || !v.host || !v.username || !v.fromName || !v.fromEmail || v.postalAddress.trim().length < 10 || (!a?.hasPassword && !v.password)} onClick={save}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("outbox.set.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
