"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X } from "lucide-react";
import { motion } from "framer-motion";

const INDUSTRIES = [
  { value: "restaurant", key: "camp.ind.restaurant" },
  { value: "cafe", key: "camp.ind.cafe" },
  { value: "retail", key: "camp.ind.retail" },
  { value: "automotive", key: "camp.ind.automotive" },
  { value: "healthcare", key: "camp.ind.healthcare" },
  { value: "beauty", key: "camp.ind.beauty" },
  { value: "education", key: "camp.ind.education" },
  { value: "realestate", key: "camp.ind.realestate" },
  { value: "event", key: "camp.ind.event" },
  { value: "tech", key: "camp.ind.tech" },
  { value: "professional", key: "camp.ind.professional" },
] as const;

export function CreateCampaignForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [queries, setQueries] = useState<string[]>([""]);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    location: "",
    yourService: "",
    maxResults: "20",
    contentStyle: "balanced",
    language: "indonesian",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const addQuery = () => setQueries((q) => [...q, ""]);
  const removeQuery = (i: number) => setQueries((q) => q.filter((_, idx) => idx !== i));
  const updateQuery = (i: number, v: string) =>
    setQueries((q) => q.map((old, idx) => (idx === i ? v : old)));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const campaign = await api.post<{ id: string }>("/campaigns", {
        name: form.name,
        industry: form.industry,
        location: form.location,
        searchQueries: queries.filter(Boolean),
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

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("camp.form.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">{t("camp.form.name")}</Label>
            <Input id="name" placeholder={t("camp.form.namePh")} value={form.name} onChange={set("name")} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("camp.form.industry")}</Label>
              <Select value={form.industry} onValueChange={(v) => setForm((p) => ({ ...p, industry: v }))}>
                <SelectTrigger><SelectValue placeholder={t("camp.form.industryPh")} /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.value}>{t(i.key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t("camp.form.location")}</Label>
              <Input id="location" placeholder={t("camp.form.locationPh")} value={form.location} onChange={set("location")} required />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("camp.form.queries")}</Label>
              <Badge variant="secondary" className="text-xs">
                {t(queries.length === 1 ? "camp.form.queryCountOne" : "camp.form.queryCountMany", { n: queries.length })}
              </Badge>
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
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuery(i)} className="flex-shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addQuery} className="text-xs mt-1">
              <Plus className="w-3 h-3 mr-1" />{t("camp.form.addQuery")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">{t("camp.form.service")}</Label>
            <Textarea
              id="service"
              placeholder={t("camp.form.servicePh")}
              value={form.yourService}
              onChange={set("yourService")}
              className="resize-none"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("camp.form.maxResults")}</Label>
              <Select value={form.maxResults} onValueChange={(v) => setForm((p) => ({ ...p, maxResults: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "20", "50", "100"].map((n) => (
                    <SelectItem key={n} value={n}>{t("camp.form.leadsCount", { n })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("camp.form.contentStyle")}</Label>
              <Select value={form.contentStyle} onValueChange={(v) => setForm((p) => ({ ...p, contentStyle: v }))}>
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
              <Label>{t("camp.form.language")}</Label>
              <Select value={form.language} onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indonesian">{t("camp.lang.indonesian")}</SelectItem>
                  <SelectItem value="english">{t("camp.lang.english")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>{t("camp.form.cancel")}</Button>
          <Button type="submit" variant="gradient" className="flex-1" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("camp.form.starting")}</>
            ) : (
              t("camp.form.start")
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.form>
  );
}
