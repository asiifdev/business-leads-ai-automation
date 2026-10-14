"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, Search, Globe, MapPin, Star, Mail, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useLead } from "@/hooks/use-leads";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { leadsEn } from "@/lib/i18n/features-leads.en";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function LeadDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const crmLabel = (v: string) => (`leads.crm.${v}` in leadsEn ? t(`leads.crm.${v}` as keyof typeof leadsEn) : v);
  const { lead, loading, refresh } = useLead(id);
  const [crmStatus, setCrmStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deal, setDeal] = useState<{ value: string; lost: string; follow: string } | null>(null);
  const dealForm = deal ?? { value: lead?.dealValue != null ? String(lead.dealValue) : "", lost: lead?.lostReason ?? "", follow: lead?.followUpDate ? lead.followUpDate.slice(0, 10) : "" };
  const saveDeal = async (extra: object = {}) => {
    setSaving(true);
    try {
      await api.patch(`/leads/${id}/crm`, {
        ...(dealForm.value.trim() !== "" && { dealValue: Math.max(0, Math.round(Number(dealForm.value.replace(/\D/g, "")) || 0)) }),
        ...(dealForm.lost.trim() && { lostReason: dealForm.lost.trim() }),
        ...(dealForm.follow && { followUpDate: dealForm.follow }),
        ...extra,
      });
      setDeal(null);
      await refresh();
    } catch (e) {
      console.error("Deal update failed:", e);
    } finally {
      setSaving(false);
    }
  };
  const [enriching, setEnriching] = useState(false);
  const enrich = async () => {
    setEnriching(true);
    try { await api.post(`/leads/${id}/enrich`, {}); await refresh(); } catch (e) { console.error("Enrich failed:", e); } finally { setEnriching(false); }
  };

  const handleCrmUpdate = async () => {
    if (!crmStatus || !lead) return;
    setSaving(true);
    try {
      await api.patch(`/leads/${id}/crm`, { crmStatus });
      await refresh();
    } catch (e) {
      console.error("CRM update failed:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-3/4" />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  if (!lead) {
    return <div className="text-center py-20 text-muted-foreground">{t("leads.detail.notFound")}</div>;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-4xl"
    >
      <motion.div variants={item} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leads" aria-label={t("leads.detail.back")}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{lead.name}</h1>
            {lead.priority === "HIGH" && <Badge variant="success">{t("leads.detail.highPriority")}</Badge>}
            {lead.hasWebsite && <Badge variant="info">{t("leads.detail.hasWebsite")}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{lead.industry} · {lead.address}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold text-primary">{lead.score}</div>
          <div className="text-xs text-muted-foreground">{t("leads.detail.aiScore")}</div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("leads.detail.contact")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Phone, label: t("leads.detail.phone"), value: lead.phone },
                { icon: Mail, label: t("leads.enrich.email"), value: lead.email ?? undefined },
                { icon: Globe, label: t("leads.detail.website"), value: lead.website },
                { icon: MapPin, label: t("leads.detail.address"), value: lead.address },
                { icon: Star, label: t("leads.detail.rating"), value: lead.rating ? t("leads.detail.ratingValue", { rating: lead.rating }) : undefined },
              ]
                .filter((i) => i.value)
                .map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm flex-1 break-all">{item.value}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-40 hover:opacity-100 flex-shrink-0"
                      onClick={() => navigator.clipboard.writeText(item.value!)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Found on their website */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("leads.enrich.title")}</CardTitle>
              {lead.website && (
                <Button variant="outline" size="sm" onClick={enrich} disabled={enriching}>
                  {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  {enriching ? t("leads.enrich.finding") : t("leads.enrich.find")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!lead.website ? (
                <p className="text-muted-foreground">{t("leads.enrich.noWebsite")}</p>
              ) : !lead.enrichedAt ? (
                <p className="text-muted-foreground">{t("leads.enrich.notYet")}</p>
              ) : lead.enrichment?.status === "unreachable" ? (
                <p className="text-muted-foreground">{t("leads.enrich.unreachable")}</p>
              ) : (() => {
                const e: NonNullable<typeof lead.enrichment> = lead.enrichment ?? { status: "enriched" };
                const rows: { label: string; value: string; href?: string }[] = [
                  ...(e.emails ?? []).map((v) => ({ label: t("leads.enrich.email"), value: v, href: `mailto:${v}` })),
                  ...(e.whatsapp ?? []).map((v) => ({ label: t("leads.enrich.whatsapp"), value: `+${v}`, href: `https://wa.me/${v}` })),
                  ...(e.whatsappHandles ?? []).map((h) => ({ label: t("leads.enrich.whatsapp"), value: t("leads.enrich.username", { handle: h }), href: `https://wa.me/${h}` })),
                  ...Object.entries(e.social ?? {}).map(([k, v]) => ({ label: k, value: v.replace(/^https?:\/\/(www\.)?/, ""), href: v })),
                ];
                return rows.length === 0 ? <p className="text-muted-foreground">{t("leads.enrich.none")}</p> : rows.map((r) => (
                  <div key={r.label + r.value} className="flex items-baseline gap-3">
                    <span className="w-24 flex-shrink-0 text-xs capitalize text-muted-foreground">{r.label}</span>
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">{r.value}</a>
                  </div>
                ));
              })()}
            </CardContent>
          </Card>

          {/* AI Marketing Content */}
          {lead.marketingContent?.source === "llm" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("leads.detail.notes")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.marketingContent.email && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4 text-info" />
                      <span className="text-sm font-medium">{t("leads.detail.email")}</span>
                      <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs opacity-60 hover:opacity-100" onClick={() => navigator.clipboard.writeText(lead.marketingContent!.email!.body)}>
                        {t("leads.detail.copy")}
                      </Button>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-xs leading-relaxed">
                      <p className="font-medium text-muted-foreground mb-1.5">{t("leads.detail.subject", { subject: lead.marketingContent.email.subject })}</p>
                      <p className="whitespace-pre-wrap">{lead.marketingContent.email.body}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* CRM Panel */}
        <motion.div variants={item} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("leads.detail.crmTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                defaultValue={lead.crmStatus}
                onValueChange={(v) => setCrmStatus(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">🔵 {t("leads.crm.new")}</SelectItem>
                  <SelectItem value="contacted">📤 {t("leads.crm.contacted")}</SelectItem>
                  <SelectItem value="replied">💬 {t("leads.crm.replied")}</SelectItem>
                  <SelectItem value="interested">🙋 {t("leads.crm.interested")}</SelectItem>
                  <SelectItem value="meeting">📅 {t("leads.crm.meeting")}</SelectItem>
                  <SelectItem value="proposal">📄 {t("leads.crm.proposal")}</SelectItem>
                  <SelectItem value="won">✅ {t("leads.crm.won")}</SelectItem>
                  <SelectItem value="lost">❌ {t("leads.crm.lost")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="gradient"
                className="w-full text-sm h-9"
                onClick={handleCrmUpdate}
                disabled={saving || !crmStatus}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("leads.detail.updateStatus")}
              </Button>
              {lead.needsReply && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-2 text-xs">
                  <p>{t("leads.deal.waiting")}</p>
                  <button type="button" className="mt-1 underline" onClick={() => saveDeal({ needsReply: false })}>{t("leads.deal.markHandled")}</button>
                </div>
              )}
              <div className="space-y-2 border-t pt-3 text-sm">
                <label className="block text-xs text-muted-foreground">{t("leads.deal.value")}
                  <Input inputMode="numeric" value={dealForm.value} onChange={(e) => setDeal({ ...dealForm, value: e.target.value })} className="mt-1 h-9" />
                </label>
                <label className="block text-xs text-muted-foreground">{t("leads.deal.followUp")}
                  <Input type="date" value={dealForm.follow} onChange={(e) => setDeal({ ...dealForm, follow: e.target.value })} className="mt-1 h-9" />
                </label>
                {(crmStatus ?? lead.crmStatus) === "lost" && (
                  <label className="block text-xs text-muted-foreground">{t("leads.deal.lostReason")}
                    <Input value={dealForm.lost} onChange={(e) => setDeal({ ...dealForm, lost: e.target.value })} className="mt-1 h-9" />
                  </label>
                )}
                <Button variant="outline" className="w-full text-sm h-9" onClick={() => saveDeal()} disabled={saving}>{t("leads.deal.save")}</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("leads.detail.activityLog")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(lead.activities || []).map((a) => (
                  <div key={a.id} className="text-xs border-l-2 border-primary/30 pl-3">
                    <p className="font-medium capitalize text-muted-foreground">{`leads.activity.${a.type}` in leadsEn ? t(`leads.activity.${a.type}` as keyof typeof leadsEn) : a.type}</p>
                    <p className="mt-0.5">
                      {a.type === "crm_update" && a.metadata?.crmStatus
                        ? t("leads.activity.statusChanged", { status: crmLabel(a.metadata.crmStatus) })
                        : a.note}
                    </p>
                    {a.type === "referral" && (a.metadata?.contacts ?? []).map((c) => (
                      <Button key={c.phone} size="sm" variant="outline" className="mt-1.5 mr-2 h-7 text-xs" onClick={async () => {
                        try {
                          const r = await api.post<{ created: boolean; leadId: string }>(`/leads/${lead.id}/referral`, { phone: c.phone, ...(c.name ? { name: c.name } : {}) });
                          toast.success(t(r.created ? "leads.referral.added" : "leads.referral.exists"));
                        } catch (e) { toast.error((e as Error).message); }
                      }}>{t("leads.referral.add", { who: c.name ?? c.phone })}</Button>
                    ))}
                  </div>
                ))}
                {(!lead.activities || lead.activities.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("leads.detail.noActivity")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
