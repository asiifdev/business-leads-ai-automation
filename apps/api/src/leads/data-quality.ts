/**
 * How far a lead's contact data can be trusted before a message is written to it. This is separate from fit: a perfect
 * fit with a dead number is still a wasted message. Pure, so the rules are testable and the reasons can be shown.
 */
export type DataQuality = "high" | "medium" | "low";

export type QualityIssue =
  | "permanently_closed"
  | "temporarily_closed"
  | "duplicate"
  | "no_contact"
  | "phone_not_on_whatsapp"
  | "email_domain_invalid"
  | "website_unreachable"
  | "website_parked"
  | "stale";

export interface QualityInput {
  phone?: string | null;
  phoneE164?: string | null;
  email?: string | null;
  businessStatus?: string | null;
  duplicateOfId?: string | null;
  enrichedAt?: Date | null;
  scrapedAt?: Date | null;
  /** The stored JSON of free checks (see validation.ts); anything that is not an object counts as no checks. */
  validation?: unknown;
}

export const STALE_DAYS = 90;
const DAY_MS = 86_400_000;

/** Issues that make a message pointless or wrong. The lead is rated low and gets no bulk draft. */
export const BLOCKING: ReadonlySet<QualityIssue> = new Set(["permanently_closed", "duplicate", "no_contact", "phone_not_on_whatsapp"]);

/** The latest time anyone looked at this lead's data: the scrape, a website read, or a WhatsApp or e-mail check. */
export function lastChecked(lead: QualityInput): Date | null {
  const v = lead.validation && typeof lead.validation === "object" ? (lead.validation as { checkedAt?: unknown }).checkedAt : undefined;
  const times = [lead.scrapedAt, lead.enrichedAt, typeof v === "string" ? new Date(v) : null].filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
}

export function assessQuality(lead: QualityInput, now: Date = new Date()): { level: DataQuality; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  const v = (lead.validation && typeof lead.validation === "object" && !Array.isArray(lead.validation) ? lead.validation : {}) as { waRegistered?: boolean | null; emailMx?: boolean | null; websiteLive?: boolean | null; websiteParked?: boolean | null };
  if (lead.businessStatus === "permanently_closed") issues.push("permanently_closed");
  if (lead.businessStatus === "temporarily_closed") issues.push("temporarily_closed");
  if (lead.duplicateOfId) issues.push("duplicate");
  if (!lead.phoneE164 && !lead.phone && !lead.email) issues.push("no_contact");
  // A phone that is not on WhatsApp only blocks when it is the only way in.
  if (v.waRegistered === false) issues.push("phone_not_on_whatsapp");
  if (v.emailMx === false) issues.push("email_domain_invalid");
  if (v.websiteParked) issues.push("website_parked");
  else if (v.websiteLive === false) issues.push("website_unreachable");
  const checked = lastChecked(lead);
  if (checked && now.getTime() - checked.getTime() > STALE_DAYS * DAY_MS) issues.push("stale");

  const blocking = issues.some((i) => BLOCKING.has(i) && !(i === "phone_not_on_whatsapp" && lead.email && v.emailMx !== false));
  if (blocking) return { level: "low", issues };
  return { level: issues.length ? "medium" : "high", issues };
}

/** Whether bulk drafting should leave this lead out. */
export function qualityAllows(level: string | null | undefined): boolean {
  return level !== "low";
}

export type GateReason = "lowQuality" | "notOnWhatsapp" | "badEmail";

/** Why bulk drafting should leave this lead out for a channel, or null when it may be drafted. Drafts for it cost AI calls, so the check comes first. */
export function draftGate(lead: QualityInput, channel: "whatsapp" | "email", now: Date = new Date()): GateReason | null {
  const { level, issues } = assessQuality(lead, now);
  if (channel === "whatsapp" && issues.includes("phone_not_on_whatsapp")) return "notOnWhatsapp";
  if (channel === "email" && issues.includes("email_domain_invalid")) return "badEmail";
  return level === "low" ? "lowQuality" : null;
}

const RISK_LABEL: Record<QualityIssue, string> = {
  permanently_closed: "permanently-closed",
  temporarily_closed: "temporarily-closed",
  duplicate: "duplicate-lead",
  no_contact: "no-contact",
  phone_not_on_whatsapp: "not-on-whatsapp",
  email_domain_invalid: "email-domain-invalid",
  website_unreachable: "website-unreachable",
  website_parked: "website-parked",
  stale: "stale-data",
};

/** Labels for a draft's risk flags: everything wrong with the lead's data, so a draft written for one lead by hand still warns the reviewer. */
export function qualityRiskLabels(lead: QualityInput, now: Date = new Date()): string[] {
  return assessQuality(lead, now).issues.map((i) => RISK_LABEL[i]);
}

/** Whether the lead's own website should be read again: it has one and it was never read, or not for STALE_DAYS. */
export function websiteReadDue(lead: { website?: string | null; enrichedAt?: Date | null }, now: Date = new Date()): boolean {
  if (!lead.website) return false;
  return !lead.enrichedAt || now.getTime() - lead.enrichedAt.getTime() > STALE_DAYS * DAY_MS;
}
