"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pause, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Overview } from "./types";

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

function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    import("qrcode").then((q) => q.toDataURL(value, { margin: 1, width: 224 })).then((u) => { if (live) setSrc(u); }).catch(() => setSrc(""));
    return () => { live = false; };
  }, [value]);
  // white background on purpose: scanners need dark-on-light contrast even in dark mode
  return src ? <img src={src} alt="WhatsApp pairing code" width={224} height={224} className="rounded-lg bg-white p-2" /> : <div className="h-56 w-56 animate-pulse rounded-lg bg-muted" />;
}

export function WhatsappPanel({ overview, refresh }: { overview: Overview; refresh: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const a = overview.account;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const label =
    a.status === "connected" ? (a.phone ? t("outbox.wa.connected", { phone: a.phone }) : t("outbox.wa.connectedNoPhone"))
    : a.status === "qr" ? t("outbox.wa.waitingQr")
    : a.status === "connecting" ? t("outbox.wa.connecting")
    : a.status === "logged_out" ? t("outbox.wa.loggedOut")
    : t("outbox.wa.disconnected");
  const dot = a.status === "connected" ? (a.paused ? "bg-warning" : "bg-success") : a.status === "disconnected" || a.status === "logged_out" ? "bg-muted-foreground/50" : "bg-info animate-pulse";

  return (
    <section aria-label={t("outbox.wa.title")} className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium"><span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />{label}</div>
          {a.paused && a.status === "connected" && <p className="mt-0.5 text-xs text-warning">{t("outbox.wa.paused")}</p>}
          {a.lastError && <p className="mt-0.5 max-w-md text-xs text-destructive">{a.lastError}</p>}
        </div>

        {a.status === "connected" && (
          <div className="flex flex-wrap gap-6">
            <Usage label={t("outbox.wa.thisHour")} used={overview.usage.sentLastHour} limit={a.hourlyLimit} />
            <Usage label={t("outbox.wa.today")} used={overview.usage.sentToday} limit={a.dailyLimit} />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(a.status === "disconnected" || a.status === "logged_out") && (
            <Button size="sm" disabled={busy} onClick={() => act(() => api.post("/messaging/whatsapp/connect", {}))}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("outbox.wa.connect")}
            </Button>
          )}
          {a.status === "connected" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api.patch("/messaging/whatsapp/settings", { paused: !a.paused }))}>
              {a.paused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}{a.paused ? t("outbox.wa.resume") : t("outbox.wa.pause")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><SlidersHorizontal className="mr-1.5 h-4 w-4" />{t("outbox.wa.settings")}</Button>
          {a.status !== "disconnected" && a.status !== "logged_out" && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => api.post("/messaging/whatsapp/disconnect", {}))}>{t("outbox.wa.disconnect")}</Button>
          )}
        </div>
      </div>

      {a.status === "qr" && overview.qr && (
        <div className="flex flex-wrap items-center gap-6 border-t p-4 sm:p-5">
          <QrCode value={overview.qr} />
          <div className="max-w-sm text-sm">
            <p className="font-medium">{t("outbox.wa.scanTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("outbox.wa.scanSteps")}</p>
          </div>
        </div>
      )}

      {(overview.quietNow || (overview.usage.approved > 0 && overview.etaHours)) && a.status === "connected" && (
        <div className="space-y-0.5 border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          {overview.quietNow && <p>{t("outbox.wa.quiet", { end: String(a.quietEndHour).padStart(2, "0") })}</p>}
          {overview.usage.approved > 0 && !!overview.etaHours && <p>{t("outbox.wa.eta", { hours: overview.etaHours })}</p>}
        </div>
      )}
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">{t("outbox.wa.risk")}</p>

      <SettingsDialog open={open} onClose={() => setOpen(false)} overview={overview} refresh={refresh} />
    </section>
  );
}

function ConnectionOption({ selected, onSelect, disabled, title, note, lockHref, lockLabel }: { selected: boolean; onSelect: () => void; disabled?: boolean; title: string; note: string; lockHref?: string; lockLabel?: string }) {
  return (
    <div role="radio" aria-checked={selected} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()} onKeyDown={(e) => { if (!disabled && (e.key === " " || e.key === "Enter")) { e.preventDefault(); onSelect(); } }}
      className={cn("rounded-lg border p-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/50", selected && !disabled && "border-primary bg-primary/5")}>
      <div className="font-medium">{title}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {note}
        {lockHref && <> <a href={lockHref} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{lockLabel}</a></>}
      </p>
    </div>
  );
}

function SettingsDialog({ open, onClose, overview, refresh }: { open: boolean; onClose: () => void; overview: Overview; refresh: () => void }) {
  const { t } = useI18n();
  const a = overview.account;
  const [provider, setProvider] = useState<"baileys" | "cloud_api">(overview.provider);
  const [v, setV] = useState({ hourlyLimit: a.hourlyLimit, dailyLimit: a.dailyLimit, quietStartHour: a.quietStartHour, quietEndHour: a.quietEndHour, timezone: a.timezone, defaultCountryCode: a.defaultCountryCode });
  useEffect(() => { if (open) setProvider(overview.provider); if (open) setV({ hourlyLimit: a.hourlyLimit, dailyLimit: a.dailyLimit, quietStartHour: a.quietStartHour, quietEndHour: a.quietEndHour, timezone: a.timezone, defaultCountryCode: a.defaultCountryCode }); }, [open, a]);

  const num = (k: "hourlyLimit" | "dailyLimit" | "quietStartHour" | "quietEndHour", label: string, min: number, max: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={`s-${k}`}>{label}</Label>
      <Input id={`s-${k}`} type="number" min={min} max={max} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
    </div>
  );
  const save = async () => {
    try { await api.patch("/messaging/whatsapp/settings", provider === overview.provider ? v : { ...v, provider }); toast.success(t("outbox.set.saved")); onClose(); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("outbox.set.title")}</DialogTitle></DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{t("outbox.conn.title")}</legend>
          <ConnectionOption selected={provider === "baileys"} onSelect={() => setProvider("baileys")} title={t("outbox.conn.linked")} note={t("outbox.conn.linkedNote")} />
          <ConnectionOption
            selected={provider === "cloud_api"}
            onSelect={() => setProvider("cloud_api")}
            disabled={!overview.cloudApi.entitled || !overview.cloudApi.installed}
            title={t("outbox.conn.official")}
            note={!overview.cloudApi.entitled ? t("outbox.conn.officialLocked") : !overview.cloudApi.installed ? t("outbox.conn.officialMissing") : t("outbox.conn.officialNote")}
            lockHref={!overview.cloudApi.entitled ? "https://alatpintar.id" : undefined}
            lockLabel={t("outbox.conn.learnMore")}
          />
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          {num("hourlyLimit", t("outbox.set.hourly"), 1, 30)}
          {num("dailyLimit", t("outbox.set.daily"), 1, 200)}
          {num("quietStartHour", t("outbox.set.quietStart"), 0, 23)}
          {num("quietEndHour", t("outbox.set.quietEnd"), 0, 23)}
          <div className="space-y-1.5">
            <Label htmlFor="s-tz">{t("outbox.set.tz")}</Label>
            <Input id="s-tz" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-cc">{t("outbox.set.cc")}</Label>
            <Input id="s-cc" inputMode="numeric" value={v.defaultCountryCode} onChange={(e) => setV({ ...v, defaultCountryCode: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("outbox.set.hint")}</p>
        <div className="flex justify-end"><Button onClick={save}>{t("outbox.set.save")}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
