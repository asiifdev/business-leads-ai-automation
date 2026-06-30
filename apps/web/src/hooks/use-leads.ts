"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface Lead {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  score: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  crmStatus: "new" | "contacted" | "replied" | "meeting" | "proposal" | "won" | "lost";
  crmNotes?: string;
  hasWebsite: boolean;
  industry?: string;
  category?: string;
  campaignId: string;
  campaign?: { id: string; name: string };
  marketingContent?: {
    email?: { subject: string; body: string };
    whatsapp?: string;
    instagram?: string;
    linkedin?: { connectionNote: string };
    coldCall?: { opening: string };
  };
  aiAnalysis?: {
    factors?: string[];
    recommendation?: string;
  };
  activities?: Array<{ id: string; type: string; note: string; createdAt: string }>;
  scrapedAt: string;
  createdAt: string;
}

interface PaginatedLeads {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
}

interface LeadFilter {
  campaignId?: string;
  q?: string;
  priority?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function useLeads(filter: LeadFilter = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { campaignId, q, priority, status, page = 1, limit = 50 } = filter;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (campaignId) params.set("campaignId", campaignId);
      if (q) params.set("q", q);
      if (priority) params.set("priority", priority);
      if (status) params.set("status", status);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const result = await api.get<PaginatedLeads>(`/leads?${params}`);
      setLeads(result.data);
      setTotal(result.total);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId, q, priority, status, page, limit]);

  useEffect(() => { refresh(); }, [refresh]);
  return { leads, total, loading, error, refresh };
}

export function useLead(id: string) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Lead>(`/leads/${id}`);
      setLead(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { lead, loading, error, refresh };
}
