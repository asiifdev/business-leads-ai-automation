import { Search, Brain, MessageCircle, BarChart3, Users, Zap } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Lead Discovery",
    desc: "Scrape leads from Google Maps with AI-powered scoring. Find businesses in any niche, any city.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Brain,
    title: "AI Intelligence",
    desc: "Every lead gets an AI score based on data completeness, digital presence, location, and industry potential.",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: MessageCircle,
    title: "Multi-Channel Outreach",
    desc: "Auto-generate personalized Email, WhatsApp, Instagram DM, LinkedIn notes, and cold call scripts per lead.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Users,
    title: "Built-in CRM",
    desc: "Track every lead through your pipeline: New → Contacted → Replied → Meeting → Won/Lost.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "Conversion funnel, industry breakdown, campaign ROI, and lead quality trends — all in real-time.",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
  {
    icon: Zap,
    title: "Self-Hosted & Free",
    desc: "Deploy with Docker Compose in minutes. Your data stays on your server. No subscriptions, ever.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-purple-400 text-sm font-semibold uppercase tracking-wider">Features</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
            Everything you need to close more deals
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Built for agencies, freelancers, and sales teams who want professional lead generation without the SaaS price tag.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.bg}`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
