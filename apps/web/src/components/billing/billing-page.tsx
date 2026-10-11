"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LicenseCard } from "./license-card";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

export interface PlanInfo {
  id: string;
  name: string;
  priceIdr: number;
  limits: { workspaces: number; membersPerWorkspace: number; draftsPerMonth: number };
  features: string[];
}

/** From the open-source API: what the active workspace's owner may do now. Limits are null when unlimited. */
export interface Entitlements {
  enforcing: boolean;
  isOwner: boolean;
  plan: string;
  status: string;
  readOnly: boolean;
  endsAt: string | null;
  limits: { workspaces: number | null; membersPerWorkspace: number | null; draftsPerMonth: number | null };
  usage: { workspaces: number; drafts: number } | null;
}

/** From the commercial package, when installed. Absent on self-hosted installs without it. */
interface Catalog {
  trialDays: number;
  ppnRate: number;
  yearlyMonths: number;
  founders: { quota: number; discount: number };
  plans: PlanInfo[];
}

const idr = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

export function BillingPage() {
  const { t, lang } = useI18n();
  const [sub, setSub] = useState<Entitlements | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Entitlements>("/entitlements").then(setSub).catch((e: Error) => setError(e.message));
    api.get<Catalog>("/billing/plans").then(setCatalog).catch(() => setCatalog(null));
  }, []);

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!sub || catalog === undefined) return <div className="space-y-4 p-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!sub.enforcing || !sub.usage)
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">{t("billing.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("billing.notHosted")}</p>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("billing.community.paid")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line>{t("billing.community.wa")}</Line>
            <Line>{t("billing.community.ai")}</Line>
            <p className="pt-2 text-muted-foreground">{t("billing.community.own")}</p>
          </CardContent>
        </Card>
        <LicenseCard />
      </div>
    );

  const ends = sub.endsAt ? new Date(sub.endsAt) : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86_400_000)) : null;
  const lim = sub.limits;
  const draftLimit = lim.draftsPerMonth ?? 0;
  const pct = draftLimit > 0 ? Math.min(100, Math.round((sub.usage.drafts / draftLimit) * 100)) : 100;
  const warn = pct >= 80;
  const planName = catalog?.plans.find((p) => p.id === sub.plan)?.name ?? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("billing.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("billing.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("billing.current")}: {planName}
            <Badge variant={sub.readOnly ? "destructive" : "secondary"}>{t(`billing.status.${sub.status}` as MessageKey)}</Badge>
          </CardTitle>
          <CardDescription>
            {sub.status === "trialing" && daysLeft !== null ? t("billing.trialLeft", { days: daysLeft }) : ends ? t("billing.endsAt", { date: ends.toLocaleDateString(lang === "id" ? "id-ID" : "en-US") }) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sub.readOnly && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{t("billing.inactive")}</p>}
          {!sub.isOwner && <p className="text-sm text-muted-foreground">{t("billing.notOwner")}</p>}
          <div>
            <div className="mb-1 flex justify-between text-sm"><span>{t("billing.drafts")}</span><span>{sub.usage.drafts} / {draftLimit}</span></div>
            <Progress value={pct} />
            {warn && <p className="mt-1 text-xs text-amber-600">{t("billing.warn", { pct })}</p>}
          </div>
          <div className="flex justify-between text-sm"><span>{t("billing.workspaces")}</span><span>{sub.usage.workspaces} / {lim.workspaces ?? "∞"}</span></div>
        </CardContent>
      </Card>

      {catalog && <div>
        <h2 className="mb-3 text-lg font-semibold">{t("billing.plans")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {catalog.plans.map((p) => (
            <Card key={p.id} className={p.id === sub.plan ? "border-primary" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">{p.name}{p.id === sub.plan && <Badge>{t("billing.currentBadge")}</Badge>}</CardTitle>
                <CardDescription>
                  <span className="text-xl font-semibold text-foreground">{idr(p.priceIdr)}</span> {t("billing.perMonth")}
                  <br />
                  <span className="text-xs">{t("billing.exVat", { pct: Math.round(catalog.ppnRate * 100) })}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Line>{t("billing.workspacesN", { n: p.limits.workspaces })}</Line>
                <Line>{t("billing.membersN", { n: p.limits.membersPerWorkspace })}</Line>
                <Line>{t("billing.draftsN", { n: p.limits.draftsPerMonth.toLocaleString("id-ID") })}</Line>
                {p.features.includes("whatsapp.cloud_api") && <Line>{t("billing.officialWa")}</Line>}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("billing.yearly", { months: catalog.yearlyMonths })}. {t("billing.founders", { quota: catalog.founders.quota, pct: Math.round(catalog.founders.discount * 100) })}</p>
        <p className="mt-1 text-sm">{t("billing.contact")}</p>
      </div>}
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{children}</div>;
}
