import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { AuthMotionWrapper } from "@/components/auth/auth-motion-wrapper";
import { AuthHeading, AuthLanguageToggle } from "@/components/auth/auth-heading";

export const metadata: Metadata = { title: "Sign In | Prospex" };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-glow-pulse" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-glow-pulse" />
      <AuthLanguageToggle />
      <AuthMotionWrapper>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-brand rounded-lg flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-white font-semibold text-xl">Prospex</span>
          </div>
          <AuthHeading kind="login" />
        </div>
        <LoginForm />
      </AuthMotionWrapper>
    </div>
  );
}
