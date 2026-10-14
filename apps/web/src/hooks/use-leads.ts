"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface Lead {
  id: string;
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  phone: string;
  website: string;
  rating: string;
  reviewCount?: number | null;
  score: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  crmStatus: "new" | "contacted" | "replied" | "interested" | "meeting" | "proposal" | "won" | "lost";
  crmNotes?: string;
  dealValue?: number | null;
  lostReason?: string | null;
  needsReply?: boolean;
  followUpDate?: string | null;
  email?: string | null;
  enrichedAt?: string | null;
  enrichment?: {
    status: "enriched" | "unreachable";
    emails?: string[];
    whatsapp?: string[];
    whatsappHandles?: string[];
    social?: Record<string, string>;
  } | null;
  hasWebsite: boolean;
  industry?: string;
  category?: string;
  province?: string | null;
  regency?: string | null;
  district?: string | null;
  campaignId: string;
  campaign?: { id: string; name: string };
  marketingContent?: {
    email?: { subject: string; body: string };
    linkedin?: { connectionNote: string };
    coldCall?: { opening: string };
    source?: "llm";
  };
  aiAnalysis?: {
    factors?: string[];
    recommendation?: string;
  };
  activities?: Array<{ id: string; type: string; note: string; metadata?: { crmStatus?: string; contacts?: { name: string | null; phone: string }[] } | null; createdAt: string }>;
  scrapedAt: string;
  createdAt: string;
}

interface PaginatedLeads {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
}

export interface LeadFilter {
  campaignId?: string;
  q?: string;
  priority?: string;
  status?: string;
  province?: string;
  regency?: string;
  district?: string;
  page?: number;
  limit?: number;
}

export function useLeads(filter: LeadFilter = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { campaignId, q, priority, status, province, regency, district, page = 1, limit = 50 } = filter;

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (campaignId) params.set("campaignId", campaignId);
      if (q) params.set("q", q);
      if (priority) params.set("priority", priority);
      if (status) params.set("status", status);
      if (province) params.set("province", province);
      if (regency) params.set("regency", regency);
      if (district) params.set("district", district);
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
  }, [campaignId, q, priority, status, province, regency, district, page, limit]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);
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

/** What the map needs of a lead; the API sends nulls for what is missing. */
export interface MapLead {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: string | null;
  reviewCount: number | null;
  priority: Lead["priority"];
  lat: number | null;
  lng: number | null;
}

/** Every lead with coordinates under the same filters as the list: the map is not paged. */
export function useLeadMap(filter: LeadFilter = {}, enabled = true) {
  const [points, setPoints] = useState<MapLead[]>([]);
  const [loading, setLoading] = useState(enabled);
  const { campaignId, q, priority, status, province, regency, district } = filter;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ campaignId, q, priority, status, province, regency, district })) if (v) params.set(k, v);
    api.get<MapLead[]>(`/leads/map?${params}`)
      .then((r) => { if (alive) setPoints(r); })
      .catch(() => { if (alive) setPoints([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, campaignId, q, priority, status, province, regency, district]);

  return { points, loading };
}

export interface RegionNode { name: string; count: number; regencies: { name: string; count: number; districts: { name: string; count: number }[] }[] }
export interface GeoStatus { enabled: boolean; running: boolean; pending: number; located: number }

/** Province > kabupaten/kota > kecamatan with counts. While regions are still being worked out it asks again every 20 s. */
export function useRegions(campaignId?: string) {
  const [regions, setRegions] = useState<RegionNode[]>([]);
  const [geo, setGeo] = useState<GeoStatus | null>(null);
  const [tick, setTick] = useState(0);

  /** Starts working out the area of every lead that has coordinates but no area yet (old data included). */
  const classify = useCallback(async () => {
    const g = await api.post<GeoStatus>("/leads/geo/backfill", {});
    setGeo(g);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const r = await api.get<{ regions: RegionNode[]; geo: GeoStatus }>(`/leads/regions${campaignId ? `?campaignId=${campaignId}` : ""}`);
        if (!alive) return;
        setRegions(r.regions);
        setGeo(r.geo);
        if (r.geo.running) timer = setTimeout(load, 10_000);
      } catch { /* the filters just stay empty */ }
    };
    void load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [campaignId, tick]);

  return { regions, geo, classify };
}
