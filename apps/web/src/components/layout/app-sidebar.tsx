"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Megaphone, Users, BarChart3, Settings, Zap, LogOut, Sparkles, Send, ClipboardList, CreditCard,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

const navItems = [
  { title: "nav.dashboard" as MessageKey, href: "/dashboard", icon: LayoutDashboard },
  { title: "nav.campaigns" as MessageKey, href: "/campaigns", icon: Megaphone },
  { title: "nav.leads" as MessageKey, href: "/leads", icon: Users },
  { title: "nav.analytics" as MessageKey, href: "/analytics", icon: BarChart3 },
  { title: "nav.brief" as MessageKey, href: "/brief", icon: ClipboardList },
  { title: "nav.style" as MessageKey, href: "/style", icon: Sparkles },
  { title: "nav.outbox" as MessageKey, href: "/outbox", icon: Send },
];

const bottomItems = [
  { title: "nav.integrations" as MessageKey, href: "/integrations", icon: Zap },
  { title: "nav.billing" as MessageKey, href: "/billing", icon: CreditCard },
  { title: "nav.settings" as MessageKey, href: "/settings", icon: Settings },
];

export function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, logout } = useAuth();
  const { t } = useI18n();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-sidebar">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
        <div className="w-7 h-7 bg-gradient-brand rounded-lg flex items-center justify-center flex-shrink-0 shadow-glow">
          <span className="text-white font-bold text-xs">P</span>
        </div>
        <span className="text-sidebar-foreground font-semibold">Prospex</span>
        <Badge className="ml-auto text-[10px] py-0 px-1.5 bg-accent/20 text-accent border-0">
          Beta
        </Badge>
      </div>

      <div className="px-3 py-2 border-b border-sidebar-border">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sidebar-ring"
                  transition={{ duration: 0.2 }}
                />
              )}
              <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-sidebar-ring")} />
              <span className="flex-1">{t(item.title)}</span>
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <nav className="px-3 py-3 space-y-1">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {t(item.title)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
              <div className="w-7 h-7 bg-gradient-brand rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">
                  {user ? getInitials(user.name) : "A"}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sidebar-foreground text-xs font-medium truncate">
                  {user?.name ?? "Admin"}
                </p>
                <p className="text-sidebar-foreground/50 text-[11px] truncate">
                  {user?.email ?? "admin@prospex.io"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings">{t("nav.account")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="w-3.5 h-3.5 mr-1" /> {t("nav.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-60 flex-shrink-0 overflow-hidden border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}
