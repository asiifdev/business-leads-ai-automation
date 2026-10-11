"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

interface LicenseStatus {
  managed: boolean;
  canManage?: boolean;
  hasKey?: boolean;
  tier?: string | null;
  features?: string[];
  state?: "none" | "fresh" | "grace" | "expired";
  expiresAt?: string | null;
  lastCheckedAt?: string | null;
  lastError?: string | null;
}

/** Licence key for self-hosted installs: enter a key, see what it unlocks, or ask for a free registered key. */
export function LicenseCard() {
  const { t, lang } = useI18n();
  const [st, setSt] = useState<LicenseStatus | null>(null);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const date = (v: string) => new Date(v).toLocaleDateString(lang === "id" ? "id-ID" : "en-US");

  const load = useCallback(() => api.get<LicenseStatus>("/license").then(setSt).catch(() => setSt(null)), []);
  useEffect(() => void load(), [load]);

  if (!st || st.managed) return null;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const state = st.state ?? "none";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {t("license.title")}
          <Badge variant={state === "fresh" || state === "grace" ? "secondary" : "outline"}>{t(`license.state.${state}` as MessageKey)}</Badge>
        </CardTitle>
        <CardDescription>{t("license.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {st.tier && <p>{t("license.tier", { tier: st.tier })}{st.expiresAt ? ` · ${t("license.until", { date: date(st.expiresAt) })}` : ""}</p>}
        <div>
          <p className="mb-1 font-medium">{t("license.features")}</p>
          {st.features && st.features.length > 0 ? (
            <ul className="list-disc pl-5">{st.features.map((f) => <li key={f}>{t(`license.feature.${f}` as MessageKey)}</li>)}</ul>
          ) : (
            <p className="text-muted-foreground">{t("license.none")}</p>
          )}
        </div>
        {st.lastError && <p className="text-destructive">{st.lastError}</p>}
        {st.lastCheckedAt && <p className="text-xs text-muted-foreground">{t("license.checked", { date: date(st.lastCheckedAt) })}</p>}

        {st.canManage && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.put("/license", { key }); setKey(""); }, t("license.saved")); }}>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("license.placeholder")} autoComplete="off" spellCheck={false} />
          <Button type="submit" disabled={busy || key.trim().length < 10}>{t("license.activate")}</Button>
          {st.hasKey && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => api.delete("/license"), t("license.removed"))}>{t("license.remove")}</Button>}
        </form>}

        {st.canManage && !st.hasKey && (
          <div className="border-t pt-4">
            <p className="font-medium">{t("license.free.title")}</p>
            <p className="mb-2 text-muted-foreground">{t("license.free.desc")}</p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.post("/license/register", { email }); setSent(true); }); }}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <Button type="submit" variant="secondary" disabled={busy || !email.includes("@")}>{t("license.free.send")}</Button>
            </form>
            {sent && <p className="mt-2 text-xs text-muted-foreground">{t("license.free.sent")}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
