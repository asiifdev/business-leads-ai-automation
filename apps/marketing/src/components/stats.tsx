"use client";

import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export function Stats() {
  const stats = [
    { value: "100%", label: "Open Source", desc: "MIT License — free forever" },
    { value: "5+", label: "AI Channels", desc: "Email, WA, IG, LinkedIn & more" },
    { value: "$0", label: "Monthly Cost", desc: "Self-hosted, no subscriptions" },
    { value: "10x", label: "Faster Outreach", desc: "vs manual prospecting" },
  ];

  return (
    <section className="border-y border-white/5 bg-white/[0.01]">
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-2 lg:grid-cols-4 gap-8"
      >
        {stats.map((s) => (
          <motion.div key={s.label} variants={item} className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-gradient-brand mb-1">
              {s.value}
            </div>
            <div className="text-white font-semibold text-sm mb-0.5">{s.label}</div>
            <div className="text-slate-500 text-xs">{s.desc}</div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
