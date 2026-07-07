import Link from "next/link";
import { Github } from "lucide-react";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
            <span className="text-white font-bold text-xs">P</span>
          </div>
          <span className="font-semibold text-white">Prospex</span>
          <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium border border-purple-500/20">
            Beta
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="https://github.com/asiifdev/business-leads-ai-automation" target="_blank" className="hover:text-white transition-colors">Docs</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="https://github.com/asiifdev/business-leads-ai-automation"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:block">GitHub</span>
          </Link>
          <Link
            href="http://localhost:3000/register"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors shadow-md shadow-purple-500/20"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
