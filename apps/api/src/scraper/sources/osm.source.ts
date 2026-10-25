import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { planAreas } from "../areas";
import type { LeadSource, RawSourceLead, SourceRequest } from "./lead-source";
import { placeBox } from "./place-box";
import { buildOverpassQuery, leadsFromOverpass, type Bbox } from "./osm-overpass";
import { parseOsmQuery, type OsmFilter } from "./osm-tags";

const DEFAULT_OVERPASS = "https://overpass-api.de/api/interpreter";
const MAX_AREAS = 12;
const MAX_ANSWER_BYTES = 25_000_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Businesses from OpenStreetMap, which is free and open (ODbL: keep the attribution). It finds places that have no Google Maps
 * listing, but coverage depends on how well volunteers mapped the area, and it has no ratings. The place name is turned into a
 * box with Nominatim, the search terms into tags, and one Overpass request per place returns everything in it.
 * Both services are public and shared: requests are few, identified by a User-Agent, and each answer is size-capped.
 */
@Injectable()
export class OsmSource implements LeadSource {
  readonly id = "osm";
  private readonly logger = new Logger(OsmSource.name);
  /** Replaced in tests. */
  fetchFn: typeof fetch = (input, init) => fetch(input, init);

  constructor(private readonly config: ConfigService) {}

  private get userAgent() {
    return this.config.get<string>("GEOCODER_USER_AGENT") || "Prospex/1.0 (self-hosted lead tool)";
  }

  async search(req: SourceRequest): Promise<RawSourceLead[]> {
    if (this.config.get<string>("OVERPASS_DISABLED") === "true") throw new Error("OpenStreetMap search is switched off (OVERPASS_DISABLED=true).");
    if (this.config.get<string>("GEOCODER_DISABLED") === "true") throw new Error("OpenStreetMap search needs the place lookup, which is switched off (GEOCODER_DISABLED=true).");
    const filters: OsmFilter[] = [];
    const seen = new Set<string>();
    for (const q of req.searchQueries) {
      for (const f of parseOsmQuery(q)) {
        const k = f.tag ? `t:${f.tag.join("=")}` : `n:${f.name?.toLowerCase()}`;
        if (!seen.has(k)) { seen.add(k); filters.push(f); }
      }
    }
    if (!filters.length) throw new Error("None of the search terms could be used for OpenStreetMap. Type a business type such as 'restoran', or a tag such as shop=camera.");

    const plan = planAreas(req.location, req.searchQueries.length, req.maxResults);
    const areas = plan.areas.slice(0, MAX_AREAS);
    const found: RawSourceLead[] = [];
    const keys = new Set<string>();
    const errors: string[] = [];
    for (let i = 0; i < areas.length && found.length < req.maxResults; i++) {
      try {
        const box = await this.boxFor(areas[i], req.country);
        if (!box) { errors.push(`could not find "${areas[i]}" on the map`); continue; }
        const want = req.maxResults - found.length;
        const t0 = Date.now();
        const leads = leadsFromOverpass(await this.overpass(buildOverpassQuery(filters, box, want * 3)), req.industry);
        for (const l of leads) {
          const key = l.referenceUrl;
          if (keys.has(key) || found.length >= req.maxResults) continue;
          keys.add(key);
          found.push(l);
        }
        this.logger.log(`Area "${areas[i]}": ${leads.length} places with contact details (${Date.now() - t0} ms)`);
      } catch (e) {
        errors.push(String((e as Error).message ?? e));
      }
      await req.onProgress?.(Math.round(((i + 1) / areas.length) * 100));
      if (i < areas.length - 1) await sleep(1100); // the public Nominatim allows one request a second
    }
    if (!found.length && errors.length) throw new Error(`OpenStreetMap: ${errors[0]}`);
    return found;
  }

  private boxFor(place: string, country?: string): Promise<Bbox | null> {
    return placeBox(place, this.config, this.fetchFn, country);
  }

  private async overpass(query: string): Promise<unknown> {
    const url = this.config.get<string>("OVERPASS_URL") || DEFAULT_OVERPASS;
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: { "User-Agent": this.userAgent, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(80_000),
      });
      if ((res.status === 429 || res.status === 504) && attempt === 0) { await sleep(6000); continue; }
      if (res.status === 429) throw new Error("Overpass is busy (too many requests). Try again in a minute, or set OVERPASS_URL to your own instance.");
      if (res.status === 504) throw new Error("Overpass timed out. Use a smaller place or fewer search terms.");
      if (!res.ok) throw new Error(`Overpass answered ${res.status}`);
      const length = Number(res.headers.get("content-length") ?? 0);
      if (length > MAX_ANSWER_BYTES) throw new Error("Overpass sent more than 25 MB. Use a smaller place.");
      const text = await res.text();
      if (text.length > MAX_ANSWER_BYTES) throw new Error("Overpass sent more than 25 MB. Use a smaller place.");
      try {
        const body = JSON.parse(text) as { remark?: string };
        // Overpass reports a runtime problem inside a normal 200 answer.
        if (body.remark && /runtime error|timed out|out of memory/i.test(body.remark)) throw new Error(`Overpass: ${body.remark.slice(0, 160)}`);
        return body;
      } catch (e) {
        if ((e as Error).message.startsWith("Overpass:")) throw e;
        throw new Error("Overpass sent an answer that is not JSON (it is probably overloaded).");
      }
    }
  }
}
