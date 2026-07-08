"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Megaphone, TrendingUp, Trophy, ArrowUpRight, ArrowRight, Loader2, Plus, Inbox } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCampaigns } from "@/hooks/use-campaigns";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

interface Overview {
  totalLeads: number;
  activeCampaigns: number;
  conversionRate: string;
  dealsWon: number;
}

export function DashboardOverview() {
  const { campaigns, loading } = useCampaigns();
  const recent = campaigns.slice(0, 4);
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<Overview>("/analytics").then(setOverview).catch(console.error);
  }, []);

  const stats = [
    { title: "Total Leads", value: overview?.totalLeads.toLocaleString() ?? "—", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Active Campaigns", value: overview?.activeCampaigns.toString() ?? "—", icon: Megaphone, color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Conversion Rate", value: overview?.conversionRate ?? "—", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Deals Won", value: overview?.dealsWon.toString() ?? "—", icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  // Build trend from campaign data (campaigns per week by createdAt)
  const trendData = campaigns.slice(-6).map((c) => ({
    date: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    leads: c.totalLeads,
    won: c.priorityLeads,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Good morning 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Here&apos;s what&apos;s happening with your leads today.
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />New Campaign
          </Link>
        </Button>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card interactive className="h-full">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-success" />
                </div>
                {overview ? (
                  <p className="text-2xl font-bold">{stat.value}</p>
                ) : (
                  <Skeleton className="h-7 w-16 mb-0.5" />
                )}
                <p className="text-sm text-muted-foreground mt-0.5">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lead Generation Trend</CardTitle>
              <Badge variant="outline" className="text-xs">Last 6 months</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="leads" stroke="#8b5cf6" strokeWidth={2} fill="url(#g1)" name="Total Leads" />
                <Area type="monotone" dataKey="won" stroke="#10b981" strokeWidth={2} fill="url(#g2)" name="Priority Leads" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Campaigns</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs h-7 px-2">
                <Link href="/campaigns">View all <ArrowRight className="ml-1 w-3 h-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <div className="p-3 rounded-full bg-muted">
                  <Inbox className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No campaigns yet</p>
                <Button asChild size="sm" variant="outline" className="mt-1">
                  <Link href="/campaigns/new">Create your first campaign</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((c) => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-brand rounded-lg flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.totalLeads} leads · {formatDate(c.createdAt)}
                      </p>
                    </div>
                    {c.status === "running" && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-info flex-shrink-0" />
                    )}
                    {c.status === "completed" && (
                      <Badge variant="success" className="text-[10px] py-0">Done</Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
