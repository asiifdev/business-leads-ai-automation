import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { planAreas } from "../areas";
import type { LeadSource, RawSourceLead, SourceRequest } from "./lead-source";
import { overtureFilters } from "./overture-categories";
import { buildPlacesQuery, leadsFromRows, type OvertureRow } from "./overture-query";
import { placeBox } from "./place-box";

const STAC = "https://stac.overturemaps.org/catalog.json";
const MAX_AREAS = 12;
const QUERY_TIMEOUT_MS = 15 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Runner = (sql: string, values: (string | number)[]) => Promise<OvertureRow[]>;

/**
 * Places from Overture Maps (free, open: CDLA-Permissive-2.0, Apache-2.0, CC0 depending on the contributor; mostly Meta, Foursquare,
 * Microsoft). It reaches small businesses that only have a Facebook page. The data is read straight from Overture's public parquet
 * files with DuckDB, with no key: the first search after the server starts reads the files' index and can take five minutes (292 seconds in a test), later
 * ones take seconds. Point OVERTURE_PLACES_URL at a local copy to make every search fast.
 * DuckDB is loaded only when this source is used, so a machine where its native binary cannot run loses this source and nothing else.
 */
@Injectable()
export class OvertureSource implements LeadSource, OnModuleDestroy {
  readonly id = "overture";
  private readonly logger = new Logger(OvertureSource.name);
  /** Replaced in tests. */
  fetchFn: typeof fetch = (input, init) => fetch(input, init);
  /** Replaced in tests; the real one runs the query in DuckDB. */
  run: Runner = (sql, values) => this.duckdb(sql, values);
  private conn: { run: (sql: string, values?: (string | number)[]) => Promise<unknown>; runAndReadAll: (sql: string, values?: (string | number)[]) => Promise<{ getRowObjectsJson(): OvertureRow[] }>; interrupt(): void; closeSync(): void } | null = null;
  private opening: Promise<NonNullable<OvertureSource["conn"]>> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private release: { name: string; at: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleDestroy() {
    this.reset();
  }

  private reset() {
    try { this.conn?.closeSync(); } catch { /* already gone */ }
    this.conn = null;
    this.opening = null;
  }

  private async open() {
    this.opening ??= (async () => {
      let api: typeof import("@duckdb/node-api");
      try {
        api = await import("@duckdb/node-api");
      } catch (e) {
        throw new Error(`Overture Maps needs the DuckDB package, which could not be loaded on this machine (${String((e as Error).message).split("\n")[0].slice(0, 160)}). The other sources are not affected.`);
      }
      const instance = await api.DuckDBInstance.create(":memory:");
      const conn = await instance.connect();
      await conn.run(`SET memory_limit='${/^[0-9]{1,2}(\.[0-9])?GB$/.test(this.config.get<string>("OVERTURE_MEMORY_LIMIT") ?? "") ? this.config.get<string>("OVERTURE_MEMORY_LIMIT") : "1GB"}'; SET threads=2;`);
      await conn.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");
      this.conn = conn as unknown as NonNullable<OvertureSource["conn"]>;
      return this.conn;
    })().catch((e) => { this.opening = null; throw e; });
    return this.opening;
  }

  /** One query at a time: DuckDB would otherwise hold several big result sets in memory at once. */
  private duckdb(sql: string, values: (string | number)[]): Promise<OvertureRow[]> {
    const job = this.queue.then(async () => {
      const conn = await this.open();
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => { try { conn.interrupt(); } catch { /* already done */ } rej(new Error("Overture Maps took more than 15 minutes. Use a smaller place or a local copy (OVERTURE_PLACES_URL).")); }, QUERY_TIMEOUT_MS); });
      try {
        const result = await Promise.race([conn.runAndReadAll(sql, values), timeout]);
        return result.getRowObjectsJson();
      } catch (e) {
        // After an internal error DuckDB refuses every later query on that database; the next search opens a new one.
        if (/INTERNAL|FATAL|invalidated/i.test(String((e as Error).message))) this.reset();
        throw e;
      } finally {
        clearTimeout(timer);
      }
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Where the places are: the configured address, else the latest release in Overture's public catalogue. */
  async dataset(): Promise<string> {
    const custom = this.config.get<string>("OVERTURE_PLACES_URL");
    if (custom) return custom;
    const pinned = this.config.get<string>("OVERTURE_RELEASE");
    let name = pinned;
    if (!name) {
      if (!this.release || Date.now() - this.release.at > 12 * 3_600_000) {
        const res = await this.fetchFn(STAC, { headers: { "User-Agent": this.config.get<string>("GEOCODER_USER_AGENT") || "Prospex/1.0 (self-hosted lead tool)" }, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`Overture's catalogue answered ${res.status}. Set OVERTURE_RELEASE (for example 2026-10-21.0) to skip it.`);
        const latest = ((await res.json()) as { latest?: unknown }).latest;
        if (typeof latest !== "string" || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(latest)) throw new Error("Overture's catalogue did not name a release. Set OVERTURE_RELEASE.");
        this.release = { name: latest, at: Date.now() };
      }
      name = this.release.name;
    }
    if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(name)) throw new Error("OVERTURE_RELEASE must look like 2026-10-21.0");
    return `s3://overturemaps-us-west-2/release/${name}/theme=places/type=place/*`;
  }

  async search(req: SourceRequest): Promise<RawSourceLead[]> {
    if (this.config.get<string>("OVERTURE_DISABLED") === "true") throw new Error("Overture Maps search is switched off (OVERTURE_DISABLED=true).");
    if (this.config.get<string>("GEOCODER_DISABLED") === "true") throw new Error("Overture Maps search needs the place lookup, which is switched off (GEOCODER_DISABLED=true).");
    const { stems, names } = overtureFilters(req.searchQueries);
    if (!stems.length && !names.length) throw new Error("None of the search terms could be used for Overture Maps. Type a business type such as 'restoran', or category=camera_store.");
    const minConfidence = Number(this.config.get<string>("OVERTURE_MIN_CONFIDENCE") ?? "0.25");
    const dataset = await this.dataset();
    const areas = planAreas(req.location, req.searchQueries.length, req.maxResults).areas.slice(0, MAX_AREAS);
    const found: RawSourceLead[] = [];
    const keys = new Set<string>();
    const errors: string[] = [];
    for (let i = 0; i < areas.length && found.length < req.maxResults; i++) {
      try {
        const box = await placeBox(areas[i], this.config, this.fetchFn);
        if (!box) { errors.push(`could not find "${areas[i]}" on the map`); continue; }
        const want = req.maxResults - found.length;
        const t0 = Date.now();
        const q = buildPlacesQuery({ dataset, box, stems, names, minConfidence: Number.isFinite(minConfidence) ? minConfidence : 0.25, limit: want * 4 });
        const rows = await this.run(q.sql, q.values);
        const leads = leadsFromRows(rows, req.industry);
        for (const l of leads) {
          const key = `${l.name.toLowerCase()}|${l.lat}|${l.lng}`;
          if (keys.has(key) || found.length >= req.maxResults) continue;
          keys.add(key);
          found.push(l);
        }
        this.logger.log(`Area "${areas[i]}": ${leads.length} places (${Date.now() - t0} ms)`);
      } catch (e) {
        errors.push(String((e as Error).message ?? e));
      }
      await req.onProgress?.(Math.round(((i + 1) / areas.length) * 100));
      if (i < areas.length - 1) await sleep(1100); // the public Nominatim allows one request a second
    }
    if (!found.length && errors.length) throw new Error(`Overture Maps: ${errors[0]}`);
    return found;
  }
}
