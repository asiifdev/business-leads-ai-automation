import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthMotionWrapper } from "@/components/auth/auth-motion-wrapper";

export const metadata: Metadata = { title: "Create Account | Prospex" };

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-glow-pulse" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-glow-pulse" />
      <AuthMotionWrapper>
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-brand rounded-lg flex items-center justify-center shadow-glow">
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
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium">Sign in</Link>
        </p>
      </AuthMotionWrapper>
    </div>
  );
}
