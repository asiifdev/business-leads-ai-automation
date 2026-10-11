"use client";

import { useState } from "react";
import { Building2, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

interface Mine {
  id: string;
  name: string;
  role: string;
  campaigns: number;
  leads: number;
  current: boolean;
}

/** Lists the businesses (workspaces) this login belongs to, switches between them and creates new ones. */
export function WorkspaceSwitcher() {
  const { workspace, switchWorkspace, createWorkspace } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Mine[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (open: boolean) => {
    if (!open) return;
    setError("");
    try {
      setItems(await api.get<Mine[]>("/workspace/mine"));
    } catch {
      setError(t("ws.switcher.error"));
    }
  };

  const pick = async (id: string) => {
    if (id === workspace?.id) return;
    setBusy(id);
    try {
      await switchWorkspace(id);
    } catch {
      setError(t("ws.switcher.error"));
      setBusy(null);
    }
  };

  const create = async () => {
    if (name.trim().length < 2) return;
    setSaving(true);
    setCreateError("");
    try {
      await createWorkspace(name.trim());
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("ws.new.error"));
      setSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu onOpenChange={load}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t("ws.switcher.label")}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground text-sm transition-colors"
          >
            <div className="w-5 h-5 bg-gradient-brand rounded flex items-center justify-center flex-shrink-0">
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <span className="flex-1 text-left font-medium truncate">{workspace?.name ?? "My Workspace"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/50 flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{t("ws.switcher.heading")}</DropdownMenuLabel>
          {items === null && !error && (
            <div className="px-2 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> {t("ws.switcher.loading")}
            </div>
          )}
          {error && <p className="px-2 py-2 text-xs text-destructive">{error}</p>}
          {items?.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={(e) => { e.preventDefault(); void pick(w.id); }} className="flex items-start gap-2">
              <div className="mt-0.5 w-4 flex-shrink-0">
                {busy === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : w.current ? <Check className="w-3.5 h-3.5" /> : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{w.name}</p>
                <p className="text-[11px] text-muted-foreground">{t("ws.switcher.stats", { campaigns: w.campaigns, leads: w.leads })}</p>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { setName(""); setCreateError(""); setCreating(true); }}>
            <Plus className="w-4 h-4 mr-2" /> {t("ws.switcher.new")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={(o) => !saving && setCreating(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ws.new.title")}</DialogTitle>
            <DialogDescription>{t("ws.new.desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-workspace-name">{t("ws.new.name")}</Label>
            <Input
              id="new-workspace-name"
              autoFocus
              maxLength={80}
              placeholder={t("ws.new.placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void create()}
            />
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={saving || name.trim().length < 2}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("ws.new.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
