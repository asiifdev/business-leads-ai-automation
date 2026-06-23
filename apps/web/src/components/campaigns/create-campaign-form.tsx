"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X } from "lucide-react";

const INDUSTRIES = [
  { value: "restaurant", label: "Restaurant & F&B" },
  { value: "cafe", label: "Cafe & Coffee" },
  { value: "retail", label: "Retail & Fashion" },
  { value: "automotive", label: "Automotive" },
  { value: "healthcare", label: "Healthcare & Clinic" },
  { value: "beauty", label: "Beauty & Wellness" },
  { value: "education", label: "Education & Course" },
  { value: "realestate", label: "Real Estate" },
  { value: "event", label: "Event & Wedding" },
  { value: "tech", label: "Technology" },
  { value: "professional", label: "Professional Services" },
];

export function CreateCampaignForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [queries, setQueries] = useState<string[]>([""]);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    location: "",
    yourService: "",
    maxResults: "20",
    contentStyle: "balanced",
    language: "indonesian",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const addQuery = () => setQueries((q) => [...q, ""]);
  const removeQuery = (i: number) => setQueries((q) => q.filter((_, idx) => idx !== i));
  const updateQuery = (i: number, v: string) =>
    setQueries((q) => q.map((old, idx) => (idx === i ? v : old)));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const campaign = await api.post<{ id: string }>("/campaigns", {
        name: form.name,
        industry: form.industry,
        location: form.location,
        searchQueries: queries.filter(Boolean),
        yourService: form.yourService,
        maxResults: Number(form.maxResults),
        contentStyle: form.contentStyle,
        language: form.language,
      });
      await api.post(`/scraper/campaigns/${campaign.id}/start`, {});
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      console.error("Failed to create campaign:", err);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input id="name" placeholder="e.g. Restaurant Bandung Q2 2026" value={form.name} onChange={set("name")} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={(v) => setForm((p) => ({ ...p, industry: v }))}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="e.g. Bandung, Jakarta" value={form.location} onChange={set("location")} required />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Search Queries</Label>
              <Badge variant="secondary" className="text-xs">
                {queries.length} {queries.length === 1 ? "query" : "queries"}
              </Badge>
            </div>
            <div className="space-y-2">
              {queries.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`e.g. ${form.industry || "restaurant"} ${form.location || "Jakarta"}`}
                    value={q}
                    onChange={(e) => updateQuery(i, e.target.value)}
                    required
                  />
                  {queries.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuery(i)} className="flex-shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addQuery} className="text-xs mt-1">
              <Plus className="w-3 h-3 mr-1" />Add search query
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Your Service / Product</Label>
            <Textarea
              id="service"
              placeholder="Describe what you're offering to these leads..."
              value={form.yourService}
              onChange={set("yourService")}
              className="resize-none"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max Results</Label>
              <Select value={form.maxResults} onValueChange={(v) => setForm((p) => ({ ...p, maxResults: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "20", "50", "100"].map((n) => (
                    <SelectItem key={n} value={n}>{n} leads</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content Style</Label>
              <Select value={form.contentStyle} onValueChange={(v) => setForm((p) => ({ ...p, contentStyle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indonesian">Indonesian</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700 shadow-sm shadow-purple-500/20 flex-1" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting campaign...</>
            ) : (
              "Start Campaign"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
