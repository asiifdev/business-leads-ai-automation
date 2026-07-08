"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-14 overflow-hidden">
      {/* Radial gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(120,60,255,0.2),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_60%,rgba(59,130,246,0.08),transparent)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" as const }}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center"
      >
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs px-3 py-1.5 rounded-full mb-8 font-medium">
          <Zap className="w-3 h-3" />
          Open-source · Self-hosted · Free forever
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6">
          AI-powered{" "}
          <span className="text-gradient-brand">
            lead generation
          </span>
          {" "}&amp; outreach
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Find leads from Google Maps, generate personalized Email, WhatsApp, and Instagram DM using AI,
          and manage your entire sales pipeline — all in one self-hosted dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link
            href="http://localhost:3000/register"
            className="flex items-center gap-2 bg-gradient-brand text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-glow hover:brightness-110 hover:-translate-y-0.5 text-sm"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="https://github.com/asiifdev/business-leads-ai-automation"
            target="_blank"
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl font-semibold transition-all text-sm"
          >
            <Github className="w-4 h-4" /> View on GitHub
          </Link>
        </div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" as const }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="absolute -inset-px bg-gradient-to-b from-purple-500/20 via-transparent to-transparent rounded-2xl" />
          <div className="relative bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="flex-1 mx-4 bg-white/5 rounded-md px-3 py-1 text-xs text-slate-500 text-left">
                app.prospex.io/dashboard
              </div>
            </div>
            {/* Mock UI */}
            <div className="p-6">
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Total Leads", value: "1,284", c: "text-blue-400" },
                  { label: "Campaigns", value: "8", c: "text-purple-400" },
                  { label: "Conversion", value: "18.2%", c: "text-emerald-400" },
                  { label: "Deals Won", value: "42", c: "text-amber-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-left">
                    <div className={`text-xs mb-1 ${s.c}`}>{s.label}</div>
                    <div className="text-xl font-bold text-white">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 bg-white/[0.03] border border-white/5 rounded-xl p-3 h-28 flex items-end gap-1 px-3 pb-3">
                  {[30, 50, 35, 70, 55, 85, 62, 90, 75, 100, 80, 65].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-purple-600 to-violet-500 rounded-t opacity-80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                  <div className="text-xs text-slate-400 mb-2">Recent Leads</div>
                  {["Kopi Tuku", "Filosofi Kopi", "Starbucks Kota"].map((name) => (
                    <div key={name} className="flex items-center gap-2 py-1">
                      <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-blue-500 rounded flex-shrink-0" />
                      <span className="text-xs text-slate-300 truncate">{name}</span>
                      <span className="ml-auto text-[10px] text-emerald-400 flex-shrink-0">85</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
