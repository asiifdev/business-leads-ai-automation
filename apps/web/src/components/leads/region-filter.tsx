"use client";
import { Button } from "@/components/ui/button";
import { MapPinned } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GeoStatus, RegionNode } from "@/hooks/use-leads";
import { useI18n } from "@/lib/i18n";

export interface RegionValue { province: string; regency: string; district: string }
export const NO_REGION: RegionValue = { province: "all", regency: "all", district: "all" };

/** Province, then kabupaten/kota, then kecamatan: each list only holds what the one before it contains. */
export function RegionFilter({ regions, geo, value, onChange, onClassify }: { regions: RegionNode[]; geo: GeoStatus | null; value: RegionValue; onChange: (v: RegionValue) => void; onClassify: () => void }) {
  const { t } = useI18n();
  const province = regions.find((p) => p.name === value.province);
  const regency = province?.regencies.find((k) => k.name === value.regency);
  return (
    <>
      <Select value={value.province} onValueChange={(v) => onChange({ province: v, regency: "all", district: "all" })}>
        <SelectTrigger className="w-44"><SelectValue placeholder={t("leads.region.province")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("leads.region.allProvinces")}</SelectItem>
          {regions.map((p) => <SelectItem key={p.name} value={p.name}>{p.name} ({p.count})</SelectItem>)}
        </SelectContent>
      </Select>
      {province && (
        <Select value={value.regency} onValueChange={(v) => onChange({ ...value, regency: v, district: "all" })}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("leads.region.regency")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.region.allRegencies")}</SelectItem>
            {province.regencies.map((k) => <SelectItem key={k.name} value={k.name}>{k.name} ({k.count})</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {regency && regency.districts.length > 0 && (
        <Select value={value.district} onValueChange={(v) => onChange({ ...value, district: v })}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t("leads.region.district")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.region.allDistricts")}</SelectItem>
            {regency.districts.map((d) => <SelectItem key={d.name} value={d.name}>{d.name} ({d.count})</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {geo?.running ? (
        <span className="text-xs text-muted-foreground">{t("leads.region.pending", { n: geo.pending })}</span>
      ) : geo?.enabled && geo.pending > 0 ? (
        <Button variant="outline" size="sm" onClick={onClassify}><MapPinned className="mr-1.5 h-3.5 w-3.5" />{t("leads.region.classify", { n: geo.pending })}</Button>
      ) : geo && !geo.enabled ? (
        <span className="text-xs text-muted-foreground">{t("leads.region.disabled")}</span>
      ) : null}
    </>
  );
}
