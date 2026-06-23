export function Stats() {
  const stats = [
    { value: "100%", label: "Open Source", desc: "MIT License — free forever" },
    { value: "5+", label: "AI Channels", desc: "Email, WA, IG, LinkedIn & more" },
    { value: "$0", label: "Monthly Cost", desc: "Self-hosted, no subscriptions" },
    { value: "10x", label: "Faster Outreach", desc: "vs manual prospecting" },
  ];

  return (
    <section className="border-y border-white/5 bg-white/[0.01]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-1">
              {s.value}
            </div>
            <div className="text-white font-semibold text-sm mb-0.5">{s.label}</div>
            <div className="text-slate-500 text-xs">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
