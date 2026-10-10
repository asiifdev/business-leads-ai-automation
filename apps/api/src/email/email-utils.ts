import { createHmac, timingSafeEqual } from "crypto";

export const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];

/** One header-safe line: no line breaks, bounded length. */
export function headerLine(v: string, max = 200): string {
  return v.replace(/[\r\n\v\f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Signed, tamper-proof token for the unsubscribe link: it says which workspace and which address, and nothing else. */
export function signUnsubscribe(workspaceId: string, email: string, secret: string): string {
  const payload = b64(`${workspaceId}|${email.toLowerCase()}`);
  const mac = b64(createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${mac}`;
}

export function verifyUnsubscribe(token: string, secret: string): { workspaceId: string; email: string } | null {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined || token.length > 600) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let given: Buffer;
  try { given = Buffer.from(mac, "base64url"); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [workspaceId, email, more] = Buffer.from(payload, "base64url").toString("utf8").split("|");
  if (!workspaceId || !email || more !== undefined) return null;
  return { workspaceId, email };
}

/** Plain-text footer on every message: who sends it, where they are, and a way out. */
export function buildFooter(o: { language: "indonesian" | "english"; url: string; fromName: string; postalAddress: string }): string {
  const id = o.language === "indonesian";
  return [
    "--",
    headerLine(o.fromName, 120),
    o.postalAddress.replace(/\r/g, "").trim().slice(0, 300),
    id ? `Tidak ingin menerima email dari kami lagi? Klik: ${o.url}` : `Don't want emails from us anymore? Click: ${o.url}`,
  ].join("\n");
}

/** SMTP reply codes of 5xx mean the server refused for good (bad address, rejected content); anything else may work later. */
export function isPermanentSmtpError(e: unknown): boolean {
  const code = (e as { responseCode?: number })?.responseCode;
  return typeof code === "number" && code >= 500 && code < 600;
}

export function authFailure(e: unknown): boolean {
  const x = e as { code?: string; responseCode?: number };
  return x?.code === "EAUTH" || x?.responseCode === 535;
}
