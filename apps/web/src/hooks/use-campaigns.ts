"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface Campaign {
  id: string;
  name: string;
  industry: string;
  location: string;
  searchQuery?: string;
  searchQueries?: string[];
  yourService: string;
  contentStyle: string;
  language: string;
  status: "draft" | "running" | "completed" | "failed" | "paused";
  progress: number;
  totalLeads: number;
  priorityLeads: number;
  highQualityLeads: number;
  averageScore: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Campaign[]>("/campaigns");
      setCampaigns(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { campaigns, loading, error, refresh };
}

export function useCampaign(id: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Campaign>(`/campaigns/${id}`);
      setCampaign(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { campaign, loading, error, refresh };
}
