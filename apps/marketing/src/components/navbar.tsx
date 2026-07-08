"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Github, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "https://github.com/asiifdev/business-leads-ai-automation", label: "Docs", external: true },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300 ${
        scrolled ? "border-white/5 bg-slate-950/80 backdrop-blur-xl" : "border-transparent bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-brand rounded-lg flex items-center justify-center shadow-glow">
            <span className="text-white font-bold text-xs">P</span>
          </div>
          <span className="font-semibold text-white">Prospex</span>
          <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-medium border border-accent/20">
            Beta
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              className="hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="https://github.com/asiifdev/business-leads-ai-automation"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </Link>
          <Link
            href="http://localhost:3000/register"
            className="bg-gradient-brand text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-all shadow-glow hover:brightness-110"
          >
            Get started
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden text-slate-300 hover:text-white p-2 -mr-2"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-xl"
          >
            <div className="px-4 sm:px-6 py-4 flex flex-col gap-4 text-sm">
              {links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  target={l.external ? "_blank" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <ThemeToggle />
                <Link
                  href="http://localhost:3000/register"
                  className="bg-gradient-brand text-white text-sm px-4 py-1.5 rounded-lg font-medium shadow-glow"
                >
                  Get started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
