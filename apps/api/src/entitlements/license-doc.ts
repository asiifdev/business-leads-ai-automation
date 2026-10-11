/**
 * Verification of signed licence documents. The server signs, this verifies offline.
 * Transport shape: { payload: base64(JSON), signature: base64 }, signature over the payload bytes.
 */
import { createPublicKey, verify } from "node:crypto";
import type { Feature } from "./entitlements";

export interface EntitlementDoc {
  v: 1;
  licenseId: string;
  tier: string;
  features: Feature[];
  instanceId: string;
  issuedAt: string;
  /** Fresh until here; after it the instance refreshes. */
  validUntil: string;
  /** Last moment an offline instance may keep using this document. */
  graceUntil: string;
  expiresAt: string | null;
}

export interface SignedDoc {
  payload: string;
  signature: string;
}

export function verifyDoc(signed: SignedDoc, publicKeyPem: string): EntitlementDoc | null {
  try {
    const payload = Buffer.from(signed.payload, "base64");
    if (!verify(null, payload, createPublicKey(publicKeyPem), Buffer.from(signed.signature, "base64"))) return null;
    const doc = JSON.parse(payload.toString("utf8")) as EntitlementDoc;
    return doc?.v === 1 ? doc : null;
  } catch {
    return null;
  }
}

export type DocState = "fresh" | "grace" | "expired";

export function docState(doc: EntitlementDoc, now: Date, instanceId: string): DocState {
  if (doc.instanceId !== instanceId) return "expired"; // a document copied from another install is worthless
  const t = now.getTime();
  if (doc.expiresAt && Date.parse(doc.expiresAt) <= t) return "expired";
  if (Date.parse(doc.validUntil) > t) return "fresh";
  if (Date.parse(doc.graceUntil) > t) return "grace";
  return "expired";
}
