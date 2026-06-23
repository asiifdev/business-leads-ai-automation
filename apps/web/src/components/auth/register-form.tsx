"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", workspace: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(form.name, form.email, form.password, form.workspace);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  };

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300 text-sm">Full name</Label>
              <Input id="name" placeholder="Ahmad Siif" value={form.name} onChange={set("name")}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace" className="text-slate-300 text-sm">Workspace name</Label>
              <Input id="workspace" placeholder="My Company" value={form.workspace} onChange={set("workspace")}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email" className="text-slate-300 text-sm">Email address</Label>
            <Input id="reg-email" type="email" placeholder="you@company.com" value={form.email} onChange={set("email")}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password" className="text-slate-300 text-sm">Password</Label>
            <Input id="reg-password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500"
              required minLength={8} />
          </div>
        </CardContent>
        <CardFooter className="pb-6">
          <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 h-10" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Creating account..." : "Create free account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
