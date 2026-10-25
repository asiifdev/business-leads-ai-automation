import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CampaignsService } from "../campaigns/campaigns.service";
import { ImportError, parseCsv } from "../leads/import/csv";
import { xlsxToRows } from "../leads/import/xlsx";
import { parseWebsiteList } from "../leads/import/website-list";
import { detectMapping, parseMapping, rowsToLeads, type ColumnMapping, type ImportReport } from "../leads/import/lead-import";
import type { RawSourceLead } from "./sources/lead-source";
import type { ScraperJobData } from "./scraper.processor";

export interface ImportJobData {
  campaignId: string;
  workspaceId: string;
  fileName: string;
  leads: RawSourceLead[];
}

export interface WebsiteJobData {
  campaignId: string;
  workspaceId: string;
  urls: string[];
}

export type ScraperJob = ScraperJobData | ImportJobData | WebsiteJobData;

export interface ImportPreview {
  format: "csv" | "xlsx";
  columns: string[];
  mapping: ColumnMapping;
  sample: string[][];
  rows: number;
  /** What importing with this mapping would do, or null while no column is chosen for the business name. */
  report: ImportReport | null;
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** Text of a file that is meant to be text: UTF-8, or Windows-1252 as older Excel saves it. Binary files are refused. */
function decodeText(buffer: Buffer): string {
  if (buffer.subarray(0, 4096).includes(0)) throw new ImportError("That file is not a CSV or .xlsx spreadsheet.");
  const utf8 = buffer.toString("utf8");
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

@Injectable()
export class LeadImportService {
  constructor(
    @InjectQueue("scraper") private readonly queue: Queue<ScraperJob>,
    private readonly campaigns: CampaignsService,
  ) {}

  /** The file's rows, whichever format it is in (decided from the bytes, never from the name). */
  readRows(file: { buffer: Buffer }): { format: "csv" | "xlsx"; rows: string[][] } {
    try {
      const isZip = ZIP_MAGIC.every((b, i) => file.buffer[i] === b);
      const rows = isZip ? xlsxToRows(file.buffer) : parseCsv(decodeText(file.buffer));
      if (rows.length < 2) throw new ImportError("The file has no rows below the heading line.");
      return { format: isZip ? "xlsx" : "csv", rows };
    } catch (e) {
      if (e instanceof ImportError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  preview(file: { buffer: Buffer }, industry = ""): ImportPreview {
    const { format, rows } = this.readRows(file);
    const mapping = detectMapping(rows[0]);
    let report: ImportReport | null = null;
    if (mapping.name !== null) {
      try { report = rowsToLeads(rows, mapping, industry).report; } catch (e) { if (e instanceof ImportError) throw new BadRequestException(e.message); throw e; }
    }
    return { format, columns: rows[0].map((c) => c.slice(0, 100)), mapping, sample: rows.slice(1, 6), rows: rows.length - 1, report };
  }

  /** Reads the file with the chosen columns and hands the leads to the queue; the campaign scores, saves and enriches them like a scrape's. */
  async start(workspaceId: string, campaignId: string, file: { buffer: Buffer; originalname?: string }, mappingJson?: string) {
    const campaign = await this.campaigns.findOne(campaignId, workspaceId);
    if (campaign.status === "running") throw new ConflictException("This campaign is running right now. Import when it has finished.");
    const { rows } = this.readRows(file);
    let mapping: ColumnMapping;
    try {
      let chosen: unknown = null;
      if (mappingJson) { try { chosen = JSON.parse(mappingJson); } catch { throw new ImportError("The column choice could not be read."); } }
      mapping = chosen ? parseMapping(chosen, rows[0].length) : detectMapping(rows[0]);
    } catch (e) {
      if (e instanceof ImportError) throw new BadRequestException(e.message);
      throw e;
    }
    let result: ReturnType<typeof rowsToLeads>;
    try { result = rowsToLeads(rows, mapping, campaign.industry, campaign.country); } catch (e) { if (e instanceof ImportError) throw new BadRequestException(e.message); throw e; }
    if (result.leads.length === 0) throw new BadRequestException("There is nothing to import: no row has a business name.");
    const fileName = (file.originalname ?? "file").replace(/[^\w.\- ]+/g, "_").slice(0, 80);
    await this.campaigns.updateStatus(campaignId, "running", 0);
    await this.queue.add("import", { campaignId, workspaceId, fileName, leads: result.leads }, { attempts: 1, removeOnComplete: 50, removeOnFail: 50 });
    return { message: "Import queued", campaignId, report: result.report };
  }

  /** A pasted list of websites: the addresses are checked here, the pages are read by the worker (it can take a while). */
  async startWebsites(workspaceId: string, campaignId: string, text: string) {
    const campaign = await this.campaigns.findOne(campaignId, workspaceId);
    if (campaign.status === "running") throw new ConflictException("This campaign is running right now. Import when it has finished.");
    const parsed = parseWebsiteList(text);
    if (parsed.urls.length === 0) throw new BadRequestException("There is no website address in what you pasted.");
    await this.campaigns.updateStatus(campaignId, "running", 0);
    await this.queue.add("import-websites", { campaignId, workspaceId, urls: parsed.urls }, { attempts: 1, removeOnComplete: 50, removeOnFail: 50 });
    return { message: "Websites queued", campaignId, accepted: parsed.urls.length, invalid: parsed.invalid, duplicates: parsed.duplicates, unsupported: parsed.unsupported, truncated: parsed.truncated };
  }
}
