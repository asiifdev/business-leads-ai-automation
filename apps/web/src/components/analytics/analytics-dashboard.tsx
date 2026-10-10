"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Overview {
  totalLeads: number;
  activeCampaigns: number;
  conversionRate: string;
  dealsWon: number;
  crmPipeline: Array<{ status: string; count: number }>;
}

interface IndustryRow {
  category: string | null;
  _count: { id: number };
  _avg: { score: number | null };
}

const CRM_COLORS: Record<string, string> = {
  new: "hsl(var(--muted-foreground))",
  contacted: "hsl(var(--info))",
  replied: "hsl(var(--primary))",
  meeting: "hsl(280 85% 65%)",
  proposal: "hsl(var(--warning))",
  won: "hsl(var(--success))",
  lost: "hsl(var(--destructive))",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const STATUS_KEYS = {
  new: "analytics.status.new",
  contacted: "analytics.status.contacted",
  replied: "analytics.status.replied",
  meeting: "analytics.status.meeting",
  proposal: "analytics.status.proposal",
  won: "analytics.status.won",
  lost: "analytics.status.lost",
} as const;

export function AnalyticsDashboard() {
  const { t, lang } = useI18n();
  const locale = lang === "id" ? "id-ID" : "en-US";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Overview>("/analytics"),
      api.get<IndustryRow[]>("/analytics/industries"),
    ]).then(([ov, ind]) => {
      setOverview(ov);
      setIndustries(ind);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const funnelData = (overview?.crmPipeline ?? []).map((item) => ({
    name: item.status in STATUS_KEYS
      ? t(STATUS_KEYS[item.status as keyof typeof STATUS_KEYS])
      : item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: item.count,
    color: CRM_COLORS[item.status] ?? "#94a3b8",
  }));

  const industryData = industries
    .filter((r) => r.category)
    .slice(0, 8)
    .map((r) => ({
      name: r.category!,
      leads: r._count.id,
      avgScore: Math.round(r._avg.score ?? 0),
    }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3.5 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <Skeleton className="h-[240px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = [
    { label: t("analytics.stat.totalLeads"), value: overview?.totalLeads.toLocaleString(locale) ?? "0" },
    { label: t("analytics.stat.conversionRate"), value: overview?.conversionRate ?? "0%" },
    { label: t("analytics.stat.dealsWon"), value: overview?.dealsWon.toString() ?? "0" },
    { label: t("analytics.stat.activeCampaigns"), value: overview?.activeCampaigns.toString() ?? "0" },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card interactive className="h-full">
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("analytics.industry.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {industryData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                {t("analytics.industry.empty")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={industryData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t("analytics.industry.leads")} />
                  <Bar dataKey="avgScore" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name={t("analytics.industry.avgScore")} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("analytics.funnel.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center">
                {t("analytics.funnel.empty")}
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-3">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={funnelData}
                      cx={75} cy={75}
                      innerRadius={45} outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
                <div className="space-y-2">
                  {funnelData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {funnelData.length === 0 && industryData.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {t("analytics.empty.text")}
            </p>
            <Badge variant="secondary" className="mt-3">
              {t("analytics.empty.hint")}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
