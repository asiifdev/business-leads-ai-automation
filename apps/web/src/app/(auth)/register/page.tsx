import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create Account | Prospex" };

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-white font-semibold text-xl">Prospex</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-1 text-sm">Start finding leads with AI — free forever</p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
