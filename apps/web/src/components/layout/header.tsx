"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Header() {
  return (
    <header className="h-14 border-b flex items-center gap-4 px-6 bg-background flex-shrink-0">
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads, campaigns..."
            className="pl-8 h-9 bg-muted/50 border-0 text-sm"
          />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-500 rounded-full" />
        </Button>
      </div>
    </header>
  );
}
