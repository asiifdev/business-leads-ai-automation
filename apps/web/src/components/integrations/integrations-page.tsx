"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Send, Webhook, Plug, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const integrations = [
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Send WhatsApp messages directly to leads from Prospex. One-click outreach using AI-generated content.",
    icon: MessageCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    status: "coming_soon",
    category: "Messaging",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send emails to leads directly from Prospex using your Gmail account. Full tracking & follow-up.",
    icon: Mail,
    color: "text-red-500",
    bg: "bg-red-500/10",
    status: "coming_soon",
    category: "Email",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Get real-time notifications when campaigns complete or leads update their status.",
    icon: Send,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    status: "coming_soon",
    category: "Notifications",
  },
  {
    id: "webhook",
    name: "Webhook",
    description: "Send lead data to any HTTP endpoint. Connect to Zapier, n8n, Make, or your own backend.",
    icon: Webhook,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    status: "coming_soon",
    category: "Automation",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect Prospex to 6,000+ apps. Automate lead follow-up, CRM sync, and more.",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    status: "coming_soon",
    category: "Automation",
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Self-hosted automation workflows. Build powerful pipelines with Prospex leads.",
    icon: Plug,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    status: "coming_soon",
    category: "Automation",
  },
];

const categories = [...new Set(integrations.map((i) => i.category))];

export function IntegrationsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect Prospex with your existing tools and workflows</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">
            Configure AI Keys <ArrowRight className="ml-2 h-4 w-4" />
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
            <p className="text-sm font-medium">Use the Prospex REST API</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Access all your leads and campaigns programmatically. Generate API keys in Settings.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" asChild>
              <a href={`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "")}/api/docs`} target="_blank" rel="noreferrer">
                Swagger Docs
              </a>
            </Button>
            <Button size="sm" asChild variant="gradient">
              <Link href="/settings">API Keys</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {category}
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
                          Coming Soon
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-xs leading-relaxed">
                        {integration.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </motion.div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground text-center pt-4">
        Want an integration?{" "}
        <a
          href="https://github.com/asiifdev/business-leads-ai-automation/issues"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Request it on GitHub
        </a>
      </p>
    </div>
  );
}
