"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Megaphone, Users, BarChart3, Settings, Zap, ChevronDown, Building2, LogOut,
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

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Campaigns", href: "/campaigns", icon: Megaphone, badge: "New" },
  { title: "Leads", href: "/leads", icon: Users },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
];

const bottomItems = [
  { title: "Integrations", href: "/integrations", icon: Zap },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
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
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground text-sm transition-colors">
          <div className="w-5 h-5 bg-gradient-brand rounded flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3 h-3 text-white" />
          </div>
          <span className="flex-1 text-left font-medium truncate">
            {workspace?.name ?? "My Workspace"}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/50 flex-shrink-0" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-gradient-brand shadow-glow"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <item.icon className="w-4 h-4 flex-shrink-0 relative z-10" />
              <span className="flex-1 relative z-10">{item.title}</span>
              {"badge" in item && item.badge && (
                <Badge className="relative z-10 bg-accent/20 text-accent border-0 text-[10px] py-0 px-1.5">
                  {item.badge}
                </Badge>
              )}
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
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.title}
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
              <Link href="/settings">Account settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-60 flex-shrink-0 border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}
