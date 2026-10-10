"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";

export function Header() {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Real signals only: drafts waiting for review and messages that failed.
  useEffect(() => {
    let live = true;
    const load = () => api.get<Record<string, number>>("/messaging/outbox/counts").then((c) => live && setCounts(c)).catch(() => {});
    void load();
    const id = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { live = false; clearInterval(id); };
  }, []);
  const drafts = counts.draft ?? 0;
  const failed = counts.failed ?? 0;
  return (
    <header className="h-14 border-b flex items-center gap-3 px-4 sm:px-6 bg-background/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-30">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("header.search")}
            className="pl-8 h-9 bg-muted/50 border-0 text-sm"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={t("header.notifications")}>
              <Bell className="h-4 w-4" />
              {drafts + failed > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{t("header.notifications")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {drafts + failed === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{t("header.noNotifications")}</p>}
            {drafts > 0 && (
              <DropdownMenuItem asChild>
                <Link href="/outbox" className="text-sm">{t("header.draftsWaiting", { n: drafts })}</Link>
              </DropdownMenuItem>
            )}
            {failed > 0 && (
              <DropdownMenuItem asChild>
                <Link href="/outbox" className="text-sm">{t("header.needsAttention", { n: failed })}</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
