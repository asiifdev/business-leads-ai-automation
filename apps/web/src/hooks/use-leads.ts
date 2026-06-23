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

export function useLeads(campaignId?: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const path = `/leads${campaignId ? `?campaignId=${campaignId}` : ""}`;
      const data = await api.get<Lead[]>(path);
      setLeads(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { leads, loading, error, refresh };
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
