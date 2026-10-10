/**
 * All dictionaries in one place. English is the source of truth: every Indonesian entry is typed against
 * the matching English object, so a missing translation is a compile error.
 * Core strings live in en.ts / id.ts; each feature owns its own pair of files (features-<name>.en.ts / .id.ts).
 */
import { en } from "./en";
import { id } from "./id";
import { authEn } from "./features-auth.en";
import { authId } from "./features-auth.id";
import { campaignsEn } from "./features-campaigns.en";
import { campaignsId } from "./features-campaigns.id";
import { leadsEn } from "./features-leads.en";
import { leadsId } from "./features-leads.id";
import { adminEn } from "./features-admin.en";
import { marketingEn } from "./features-marketing.en";
import { marketingId } from "./features-marketing.id";
import { adminId } from "./features-admin.id";

export const enAll = { ...en, ...authEn, ...campaignsEn, ...leadsEn, ...adminEn, ...marketingEn } as const;
export type MessageKey = keyof typeof enAll;
export const idAll: Record<MessageKey, string> = { ...id, ...authId, ...campaignsId, ...leadsId, ...adminId, ...marketingId };
