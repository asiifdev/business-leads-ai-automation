import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { cellKey, regionFromNominatim, type Region } from "./geo";

const GAP_MS = 1100; // the public Nominatim allows one request a second
const BATCH = 300;

/**
 * Fills province / kabupaten-kota / kecamatan for leads from their coordinates, in the background.
 * Google Maps addresses rarely name the city, so the address text is not enough. Point GEOCODER_URL at your own
 * Nominatim to go faster; GEOCODER_DISABLED=true turns it off (CI, offline).
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly running = new Set<string>();
  private readonly cache = new Map<string, Region | null>();

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  get enabled() {
    return this.config.get<string>("GEOCODER_DISABLED") !== "true";
  }

  async status(workspaceId: string) {
    const [pending, done] = await Promise.all([
      this.prisma.lead.count({ where: { workspaceId, geocodedAt: null, lat: { not: null }, lng: { not: null } } }),
      this.prisma.lead.count({ where: { workspaceId, province: { not: null } } }),
    ]);
    return { enabled: this.enabled, running: this.running.has(workspaceId), pending, located: done };
  }

  /** Starts a run unless one is already going; returns at once. */
  start(workspaceId: string) {
    if (!this.enabled || this.running.has(workspaceId)) return false;
    this.running.add(workspaceId);
    void this.run(workspaceId)
      .catch((e) => this.logger.warn(`Region lookup stopped: ${(e as Error).message}`))
      .finally(() => this.running.delete(workspaceId));
    return true;
  }

  private async run(workspaceId: string) {
    const skip: string[] = [];
    for (let round = 0; round < 100; round++) {
      const rows = await this.prisma.lead.findMany({
        where: { workspaceId, geocodedAt: null, lat: { not: null }, lng: { not: null }, ...(skip.length ? { id: { notIn: skip } } : {}) },
        select: { id: true, lat: true, lng: true },
        take: BATCH,
      });
      if (!rows.length) return;
      const cells = new Map<string, { lat: number; lng: number; ids: string[] }>();
      for (const r of rows) {
        const key = cellKey(r.lat!, r.lng!);
        const c = cells.get(key) ?? { lat: r.lat!, lng: r.lng!, ids: [] };
        c.ids.push(r.id);
        cells.set(key, c);
      }
      for (const [key, c] of cells) {
        let region: Region | null;
        if (this.cache.has(key)) region = this.cache.get(key) ?? null;
        else {
          try {
            region = await this.lookup(c.lat, c.lng);
          } catch (e) {
            if ((e as Error).message === "rate-limited") throw e;
            skip.push(...c.ids); // network trouble: try again on the next run, not in this one
            continue;
          }
          this.cache.set(key, region);
          if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value as string);
          await new Promise((r) => setTimeout(r, GAP_MS));
        }
        await this.prisma.lead.updateMany({ where: { id: { in: c.ids } }, data: { ...(region ?? {}), geocodedAt: new Date() } });
      }
    }
  }

  private async lookup(lat: number, lng: number): Promise<Region | null> {
    const base = (this.config.get<string>("GEOCODER_URL") || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
    const url = `${base}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=id`;
    const res = await fetch(url, { headers: { "User-Agent": this.config.get<string>("GEOCODER_USER_AGENT") || "Prospex/1.0 (self-hosted lead tool)" }, signal: AbortSignal.timeout(10_000) });
    if (res.status === 429 || res.status === 403) throw new Error("rate-limited");
    if (!res.ok) throw new Error(`geocoder answered ${res.status}`);
    const body = (await res.json()) as { address?: Parameters<typeof regionFromNominatim>[0] };
    return regionFromNominatim(body.address);
  }
}
