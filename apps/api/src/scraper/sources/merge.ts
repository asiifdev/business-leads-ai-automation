import { createDuplicateIndex } from "../../leads/dedupe";
import type { RawSourceLead } from "./lead-source";

const empty = (v: unknown) => v === "" || v === null || v === undefined || v === "N/A";

/**
 * Adds `incoming` to `leads`. A business that is already there (same phone, website domain, or name at the same place) is not added
 * again: its empty fields are filled from the new record instead, and `fieldSources` says which source each filled field came from.
 * The first record keeps its own source, so the order of sources decides whose details win.
 */
export function mergeSourceLeads(leads: RawSourceLead[], incoming: RawSourceLead[]): { leads: RawSourceLead[]; merged: number } {
  const index = createDuplicateIndex<RawSourceLead>(leads);
  const out = [...leads];
  let merged = 0;
  for (const lead of incoming) {
    const hit = index.find(lead);
    if (!hit) {
      out.push(lead);
      index.add(lead);
      continue;
    }
    merged++;
    const target = hit.match;
    const fill = <K extends keyof RawSourceLead>(key: K) => {
      if (empty(target[key]) && !empty(lead[key])) {
        target[key] = lead[key];
        target.fieldSources = { ...(target.fieldSources ?? {}), [key]: lead.source };
      }
    };
    for (const key of ["phone", "email", "address", "category", "referenceUrl", "lat", "lng", "rating", "reviewCount"] as const) fill(key);
    if (empty(target.website) && !empty(lead.website)) {
      target.website = lead.website;
      target.hasWebsite = true;
      target.fieldSources = { ...(target.fieldSources ?? {}), website: lead.source };
    }
    // A listing that says closed outweighs one that says nothing.
    if (!target.businessStatus && lead.businessStatus) {
      target.businessStatus = lead.businessStatus;
      target.fieldSources = { ...(target.fieldSources ?? {}), businessStatus: lead.source };
    }
  }
  return { leads: out, merged };
}
