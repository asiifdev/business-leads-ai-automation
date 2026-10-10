"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Send, Webhook, Plug, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

type DescKey = "integ.whatsapp.desc" | "integ.gmail.desc" | "integ.telegram.desc" | "integ.webhook.desc" | "integ.zapier.desc" | "integ.n8n.desc";
type CatKey = "integ.cat.Messaging" | "integ.cat.Email" | "integ.cat.Notifications" | "integ.cat.Automation";

const integrations: Array<{
  id: string; name: string; descKey: DescKey; icon: typeof Plug; color: string; bg: string; status: string;
  category: "Messaging" | "Email" | "Notifications" | "Automation";
}> = [
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    descKey: "integ.whatsapp.desc",
    icon: MessageCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    status: "coming_soon",
    category: "Messaging",
  },
  {
    id: "gmail",
    name: "Gmail",
    descKey: "integ.gmail.desc",
    icon: Mail,
    color: "text-red-500",
    bg: "bg-red-500/10",
    status: "coming_soon",
    category: "Email",
  },
  {
    id: "telegram",
    name: "Telegram",
    descKey: "integ.telegram.desc",
    icon: Send,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    status: "coming_soon",
    category: "Notifications",
  },
  {
    id: "webhook",
    name: "Webhook",
    descKey: "integ.webhook.desc",
    icon: Webhook,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    status: "coming_soon",
    category: "Automation",
  },
  {
    id: "zapier",
    name: "Zapier",
    descKey: "integ.zapier.desc",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    status: "coming_soon",
    category: "Automation",
  },
  {
    id: "n8n",
    name: "n8n",
    descKey: "integ.n8n.desc",
    icon: Plug,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    status: "coming_soon",
    category: "Automation",
  },
];

const categories = [...new Set(integrations.map((i) => i.category))];

export function IntegrationsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("integ.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("integ.subtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">
            {t("integ.configureAi")} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* API Keys callout */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="p-2 bg-gradient-brand rounded-lg flex-shrink-0 shadow-glow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t("integ.api.title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("integ.api.desc")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" asChild>
              <a href={`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "")}/api/docs`} target="_blank" rel="noreferrer">
                {t("integ.api.swagger")}
              </a>
            </Button>
            <Button size="sm" asChild variant="gradient">
              <Link href="/settings">{t("integ.api.keys")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t(`integ.cat.${category}` as CatKey)}
          </h2>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {integrations
              .filter((i) => i.category === category)
              .map((integration) => (
                <motion.div key={integration.id} variants={item}>
                  <Card interactive className="relative overflow-hidden h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${integration.bg} flex-shrink-0`}>
                            <integration.icon className={`w-5 h-5 ${integration.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{integration.name}</CardTitle>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                          {t("integ.comingSoon")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-xs leading-relaxed">
                        {t(integration.descKey)}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </motion.div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground text-center pt-4">
        {t("integ.request.prefix")}{" "}
        <a
          href="https://github.com/asiifdev/business-leads-ai-automation/issues"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          {t("integ.request.link")}
        </a>
      </p>
    </div>
  );
}
