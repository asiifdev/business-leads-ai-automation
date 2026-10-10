"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key, Zap, Users, Shield, Globe, Loader2, Trash2, Plus, Eye, EyeOff, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface ApiKey {
  id: string;
  name: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface NewKeyResult extends ApiKey {
  key: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export function SettingsPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  const withBold = (key: "settings.dialog.key.desc" | "settings.dialog.ws.desc", name: string) => {
    const [a, b] = t(key, { name: "\u0001" }).split("\u0001");
    return <>{a}<strong>{name}</strong>{b}</>;
  };
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savedWorkspace, setSavedWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [openaiBase, setOpenaiBase] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [savedIntegration, setSavedIntegration] = useState(false);

  const [keyPendingDelete, setKeyPendingDelete] = useState<ApiKey | null>(null);
  const [confirmDeleteWorkspace, setConfirmDeleteWorkspace] = useState(false);

  const loadApiKeys = useCallback(async () => {
    try {
      const keys = await api.get<ApiKey[]>("/settings/api-keys");
      setApiKeys(keys);
    } catch (e) {
      console.error("Failed to load API keys:", e);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => { loadApiKeys(); }, [loadApiKeys]);

  useEffect(() => {
    api.get<Workspace>("/workspace")
      .then((workspace) => {
        setWorkspaceName(workspace.name);
        setWorkspaceSlug(workspace.slug);
      })
      .catch(console.error);
  }, []);

  const saveWorkspace = async () => {
    setSavingWorkspace(true);
    setWorkspaceError("");
    try {
      const updated = await api.patch<Workspace>("/workspace", {
        name: workspaceName,
        slug: workspaceSlug,
      });
      setWorkspaceName(updated.name);
      setWorkspaceSlug(updated.slug);
      setSavedWorkspace(true);
      setTimeout(() => setSavedWorkspace(false), 2000);
    } catch (e) {
      setWorkspaceError(e instanceof Error ? e.message : t("settings.ws.error"));
    } finally {
      setSavingWorkspace(false);
    }
  };

  // Load saved AI integration config
  useEffect(() => {
    api.get<Array<{ type: string; config: Record<string, string> }>>("/settings/integrations")
      .then((integrations) => {
        const openai = integrations.find((i) => i.type === "openai");
        if (openai) {
          setOpenaiKey(openai.config.apiKey ?? "");
          setOpenaiModel(openai.config.model ?? "gpt-4o-mini");
          setOpenaiBase(openai.config.baseURL ?? "");
        }
      })
      .catch(console.error);
  }, []);

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<NewKeyResult>("/settings/api-keys", { name: newKeyName });
      setNewKey(created);
      setNewKeyName("");
      await loadApiKeys();
    } catch (e) {
      console.error("Failed to create API key:", e);
    } finally {
      setCreating(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      await api.delete(`/settings/api-keys/${id}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (e) {
      console.error("Failed to delete API key:", e);
    } finally {
      setKeyPendingDelete(null);
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveAiIntegration = async () => {
    setSavingIntegration(true);
    try {
      await api.post("/settings/integrations", {
        type: "openai",
        name: "OpenAI / Compatible API",
        config: { apiKey: openaiKey, model: openaiModel, baseURL: openaiBase },
      });
      setSavedIntegration(true);
      setTimeout(() => setSavedIntegration(false), 2000);
    } catch (e) {
      console.error("Failed to save integration:", e);
    } finally {
      setSavingIntegration(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Tabs defaultValue="workspace">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="workspace">{t("settings.tab.workspace")}</TabsTrigger>
          <TabsTrigger value="ai">{t("settings.tab.ai")}</TabsTrigger>
          <TabsTrigger value="integrations">{t("settings.tab.integrations")}</TabsTrigger>
          <TabsTrigger value="team">{t("settings.tab.team")}</TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive data-[state=active]:text-destructive">
            {t("settings.tab.danger")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("settings.ws.title")}</CardTitle>
              </div>
              <CardDescription>{t("settings.ws.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceError && (
                <div className="text-sm text-destructive">{workspaceError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("settings.ws.name")}</Label>
                  <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.ws.slug")}</Label>
                  <Input value={workspaceSlug} onChange={(e) => setWorkspaceSlug(e.target.value)} />
                </div>
              </div>
              <Button variant="gradient" onClick={saveWorkspace} disabled={savingWorkspace}>
                {savingWorkspace && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {savedWorkspace ? t("settings.saved") : t("settings.ws.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          {/* AI Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("settings.ai.title")}</CardTitle>
              </div>
              <CardDescription>{t("settings.ai.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings.ai.keyLabel")}</Label>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={t("settings.ai.keyPlaceholder")}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowKey((s) => !s)}
                    aria-label={t("settings.ai.toggleKey")}
                    className="flex-shrink-0"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.ai.keyHelp")}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t("settings.ai.model")}</Label>
                <Input
                  placeholder={t("settings.ai.modelPlaceholder")}
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("settings.ai.baseUrl")}</Label>
                  <Badge variant="secondary" className="text-xs">{t("settings.ai.baseUrlOptional")}</Badge>
                </div>
                <Input
                  placeholder={t("settings.ai.basePlaceholder")}
                  value={openaiBase}
                  onChange={(e) => setOpenaiBase(e.target.value)}
                />
              </div>
              <Button variant="gradient" onClick={saveAiIntegration} disabled={savingIntegration}>
                {savingIntegration ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : savedIntegration ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : null}
                {savedIntegration ? t("settings.saved") : t("settings.ai.save")}
              </Button>
            </CardContent>
          </Card>

          {/* Prospex API Keys */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">{t("settings.keys.title")}</CardTitle>
                </div>
              </div>
              <CardDescription>{t("settings.keys.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New key reveal */}
              {newKey && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-success">{t("settings.keys.created")}</p>
                  <div className="flex gap-2">
                    <Input value={newKey.key} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyKey(newKey.key)} aria-label={t("settings.keys.copy")}>
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setNewKey(null)}>
                    {t("settings.keys.dismiss")}
                  </Button>
                </div>
              )}

              {/* Create new key */}
              <div className="flex gap-2">
                <Input
                  placeholder={t("settings.keys.namePlaceholder")}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createApiKey()}
                />
                <Button
                  onClick={createApiKey}
                  disabled={creating || !newKeyName.trim()}
                  className="flex-shrink-0"
                  aria-label={t("settings.keys.create")}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              {/* Key list */}
              {keysLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("settings.keys.empty")}</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div key={key.id} data-testid="key-row" className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{key.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("settings.keys.createdOn", { date: formatDate(key.createdAt) })}
                          {key.lastUsedAt && ` · ${t("settings.keys.lastUsed", { date: formatDate(key.lastUsedAt) })}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setKeyPendingDelete(key)}
                        aria-label={t("settings.keys.delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("settings.integ.title")}</CardTitle>
              </div>
              <CardDescription>{t("settings.integ.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "WhatsApp Business", description: t("settings.integ.whatsapp") },
                  { name: "Gmail", description: t("settings.integ.gmail") },
                  { name: "Telegram", description: t("settings.integ.telegram") },
                  { name: "Webhook", description: t("settings.integ.webhook") },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{t("settings.integ.comingSoon")}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("settings.team.title")}</CardTitle>
              </div>
              <CardDescription>{t("settings.team.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 bg-gradient-brand rounded-full flex items-center justify-center text-white text-sm font-bold">{user ? getInitials(user.name) : "?"}</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
                  </div>
                  <Badge>{t("settings.team.owner")}</Badge>
                </div>
                <Button variant="outline" className="w-full" disabled title={t("settings.team.inviteSoon")}>
                  <Users className="mr-2 h-4 w-4" />{t("settings.team.invite")} · {t("settings.team.inviteSoon")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-destructive" />
                <CardTitle className="text-base text-destructive">{t("settings.danger.title")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("settings.danger.deleteTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.danger.deleteDesc")}</p>
                </div>
                <Button variant="destructive" size="sm" disabled title={t("settings.danger.unavailable")}>
                  {t("settings.danger.deleteTitle")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!keyPendingDelete} onOpenChange={(open) => !open && setKeyPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.dialog.key.title")}</DialogTitle>
            <DialogDescription>
              {keyPendingDelete && (
                withBold("settings.dialog.key.desc", keyPendingDelete.name)
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyPendingDelete(null)}>{t("settings.dialog.cancel")}</Button>
            <Button variant="destructive" onClick={() => keyPendingDelete && deleteApiKey(keyPendingDelete.id)}>
              {t("settings.dialog.key.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
