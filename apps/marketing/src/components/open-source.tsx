"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Github, Star, GitFork, ArrowRight } from "lucide-react";

export function OpenSource() {
  return (
    <section className="py-24 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-4xl mx-auto text-center"
      >
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-slate-300 text-xs px-3 py-1.5 rounded-full mb-8">
          <Github className="w-3.5 h-3.5" />
          100% open source · MIT license
        </div>

        <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
          Built in the open,{" "}
          <span className="text-gradient-brand">
            for everyone
          </span>
        </h2>

        <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Prospex is free and open source. Self-host it on your own server, customize it for your needs,
          or contribute to make it better for the whole community.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link
            href="https://github.com/asiifdev/business-leads-ai-automation"
            target="_blank"
            className="flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition-all text-sm shadow-lg hover:-translate-y-0.5"
          >
            <Github className="w-4 h-4" />
            View on GitHub
          </Link>
          <Link
            href="http://localhost:3000/register"
            className="flex items-center gap-2 bg-gradient-brand text-white px-6 py-3 rounded-xl font-semibold transition-all text-sm shadow-glow hover:-translate-y-0.5"
          >
            Try it now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-8 text-slate-400 text-sm mb-16">
          <span className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-400" />Star on GitHub
          </span>
          <span className="flex items-center gap-1.5">
            <GitFork className="w-4 h-4 text-blue-400" />Fork &amp; customize
          </span>
        </div>

        {/* Code snippet */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 text-left max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-4 text-slate-500 text-xs">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
            <span className="ml-2">Quick start</span>
          </div>
          <pre className="text-sm font-mono leading-relaxed">
            <span className="text-slate-500"># Clone &amp; install{"\n"}</span>
            <span className="text-emerald-400">git clone</span><span className="text-slate-300"> github.com/asiifdev/business-leads-ai-automation{"\n"}</span>
            <span className="text-emerald-400">pnpm install{"\n\n"}</span>
            <span className="text-slate-500"># Start infrastructure{"\n"}</span>
            <span className="text-emerald-400">docker compose up</span><span className="text-slate-300"> -d{"\n\n"}</span>
            <span className="text-slate-500"># Launch{"\n"}</span>
            <span className="text-emerald-400">pnpm dev</span>
          </pre>
        </div>
      </motion.div>
    </section>
  );
}
