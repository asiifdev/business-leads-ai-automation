"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Key, Zap, Users, Shield, Globe, Loader2, Trash2, Plus, Eye, EyeOff, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

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

export function SettingsPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace settings and integrations</p>
      </div>

      {/* Workspace */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Workspace</CardTitle>
          </div>
          <CardDescription>Your workspace information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Workspace Name</Label><Input defaultValue="My Workspace" /></div>
            <div className="space-y-2"><Label>Slug</Label><Input defaultValue="default" /></div>
          </div>
          <Button className="bg-purple-600 hover:bg-purple-700">Save changes</Button>
        </CardContent>
      </Card>

      {/* AI Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">AI Configuration</CardTitle>
          </div>
          <CardDescription>Configure your AI provider for lead scoring and content generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>OpenAI API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="sk-... or your provider key"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey((s) => !s)}
                className="flex-shrink-0"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Used for AI content generation and lead scoring</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              placeholder="e.g. gpt-4o-mini, gemini-flash, claude-haiku"
              value={openaiModel}
              onChange={(e) => setOpenaiModel(e.target.value)}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Base URL</Label>
              <Badge variant="secondary" className="text-xs">Optional (OpenRouter/Ollama)</Badge>
            </div>
            <Input
              placeholder="e.g. http://localhost:8045/v1"
              value={openaiBase}
              onChange={(e) => setOpenaiBase(e.target.value)}
            />
          </div>
          <Button
            className="bg-purple-600 hover:bg-purple-700"
            onClick={saveAiIntegration}
            disabled={savingIntegration}
          >
            {savingIntegration ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : savedIntegration ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {savedIntegration ? "Saved!" : "Save AI config"}
          </Button>
        </CardContent>
      </Card>

      {/* Prospex API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Prospex API Keys</CardTitle>
            </div>
          </div>
          <CardDescription>Keys to access the Prospex API from external tools</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New key reveal */}
          {newKey && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-emerald-600">New key created — copy it now, it won&apos;t be shown again</p>
              <div className="flex gap-2">
                <Input value={newKey.key} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyKey(newKey.key)}>
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setNewKey(null)}>
                Dismiss
              </Button>
            </div>
          )}

          {/* Create new key */}
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. Production, Zapier)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createApiKey()}
            />
            <Button
              onClick={createApiKey}
              disabled={creating || !newKeyName.trim()}
              className="flex-shrink-0"
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
            <p className="text-sm text-muted-foreground text-center py-4">No API keys yet</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(key.createdAt)}
                      {key.lastUsedAt && ` · Last used ${formatDate(key.lastUsedAt)}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteApiKey(key.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Integrations</CardTitle>
          </div>
          <CardDescription>Connect external services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "WhatsApp Business", description: "Send WhatsApp messages to leads" },
              { name: "Gmail", description: "Send emails directly from Prospex" },
              { name: "Telegram", description: "Get notifications via Telegram" },
              { name: "Webhook", description: "Send data to any HTTP endpoint" },
            ].map((integration) => (
              <div key={integration.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                </div>
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Team Members</CardTitle>
          </div>
          <CardDescription>Invite your team to collaborate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">A</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-muted-foreground">admin@prospex.io</p>
              </div>
              <Badge>Owner</Badge>
            </div>
            <Button variant="outline" className="w-full">
              <Users className="mr-2 h-4 w-4" />Invite team member
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-destructive" />
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete workspace</p>
              <p className="text-xs text-muted-foreground">Permanently delete your workspace and all data</p>
            </div>
            <Button variant="destructive" size="sm">Delete workspace</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
