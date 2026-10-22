/**
 * Free checks on a lead's contact data and the bookkeeping around them. Nothing here costs money or talks to a third party:
 * DNS for e-mail domains, the page we already fetched for the website, the workspace's own WhatsApp for numbers.
 */
import { promises as dns } from "node:dns";
import { assessQuality, type QualityInput } from "./data-quality";

export type Validation = {
  waRegistered?: boolean | null;
  emailMx?: boolean | null;
  websiteLive?: boolean | null;
  websiteParked?: boolean | null;
  checkedAt?: string;
};

export type FieldMeta = Record<string, { source: string; at: string }>;

type MxResolver = (domain: string) => Promise<unknown[]>;
type AddrResolver = (domain: string) => Promise<unknown[]>;

const DNS_TIMEOUT_MS = 5000;
const NO_ANSWER = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error("dns timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS).unref())]);
}

/**
 * Whether the domain of an address can receive mail: true with an MX (or, as mail rules allow, an address record), false when
 * the name does not exist or has neither, null when it could not be told (timeout, no network). No connection is made to any mail server.
 */
export async function checkEmailDomain(email: string, mx: MxResolver = dns.resolveMx, addr: AddrResolver = dns.resolve4): Promise<boolean | null> {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) return false;
  try {
    if ((await withTimeout(mx(domain))).length) return true;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (!NO_ANSWER.has(code)) return null;
  }
  try {
    return (await withTimeout(addr(domain))).length > 0;
  } catch (e) {
    return NO_ANSWER.has((e as { code?: string }).code ?? "") ? false : null;
  }
}

const PARKED = /(this domain (is|may be) for sale|domain (is )?for sale|buy this domain|domain (name )?(is )?parked|parked (free|domain)|domain (ini )?dijual|website (ini )?(sedang )?dalam (pengembangan|pembuatan)|account suspended|default web site page|index of \/)/i;

/** A page that shows a parked, for-sale, suspended or placeholder site instead of a business. Looks at the first part of the text only. */
export function looksParked(text: string): boolean {
  return PARKED.test(text.slice(0, 3000));
}

export function mergeValidation(prev: unknown, patch: Validation, now: Date = new Date()): Validation {
  const base = prev && typeof prev === "object" ? (prev as Validation) : {};
  return { ...base, ...patch, checkedAt: now.toISOString() };
}

export function withSource(prev: unknown, fields: string[], source: string, now: Date = new Date()): FieldMeta {
  const base: FieldMeta = prev && typeof prev === "object" ? { ...(prev as FieldMeta) } : {};
  for (const f of fields) base[f] = { source, at: now.toISOString() };
  return base;
}

/** The columns to store after any change to a lead's data or checks. */
export function qualityColumns(lead: QualityInput, now: Date = new Date()) {
  const q = assessQuality(lead, now);
  return { dataQuality: q.level, qualityIssues: q.issues };
}

/** A WhatsApp lookup older than this is asked again. */
export const WA_RECHECK_DAYS = 30;

export function waCheckDue(validation: unknown, now: Date = new Date()): boolean {
  const v = (validation && typeof validation === "object" ? validation : {}) as Validation;
  if (v.waRegistered === undefined || v.waRegistered === null || !v.checkedAt) return true;
  return now.getTime() - new Date(v.checkedAt).getTime() > WA_RECHECK_DAYS * 86_400_000;
}
