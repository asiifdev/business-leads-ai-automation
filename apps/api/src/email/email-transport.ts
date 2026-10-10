import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { BadRequestException } from "@nestjs/common";
import type { EmailAccount } from "@prisma/client";
import { resolvePublic } from "../marketing/safe-proxy";
import { ALLOWED_SMTP_PORTS } from "./email-utils";

/**
 * Opens an SMTP connection to the workspace's own server. The host is typed by a user, so unless the operator
 * allows private relays (EMAIL_ALLOW_PRIVATE_SMTP=true, for a self-hosted mail server on the same network) it must
 * resolve to public addresses only. The name is resolved once and the connection goes to that address, with TLS
 * still checked against the original name, so the name cannot change between the check and the connection.
 */
export async function createTransport(a: Pick<EmailAccount, "host" | "port" | "secure" | "username">, password: string): Promise<Transporter> {
  if (!ALLOWED_SMTP_PORTS.includes(a.port)) throw new BadRequestException(`Port ${a.port} is not allowed. Use one of ${ALLOWED_SMTP_PORTS.join(", ")}.`);
  const allowPrivate = process.env.EMAIL_ALLOW_PRIVATE_SMTP === "true";
  const target = allowPrivate ? a.host : await resolvePublic(a.host);
  if (!target) throw new BadRequestException("That mail server address is not allowed: it must be a public host name.");
  return nodemailer.createTransport({
    host: target,
    port: a.port,
    secure: a.secure,
    requireTLS: !a.secure, // never fall back to sending the password in clear text
    auth: { user: a.username, pass: password },
    tls: { servername: a.host },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

/** A short, user-readable reason for a failed SMTP attempt. Never includes credentials. */
export function friendlySmtpError(e: unknown): string {
  const x = e as { code?: string; responseCode?: number; message?: string };
  if (x?.code === "EAUTH" || x?.responseCode === 535) return "The mail server rejected the username or password. Many providers need an app password.";
  if (x?.code === "ECONNREFUSED") return "The mail server refused the connection. Check the host and port.";
  if (x?.code === "ETIMEDOUT" || x?.code === "ESOCKET" || x?.code === "ECONNECTION") return "Could not reach the mail server. Check the host, the port, and TLS (port 465 uses 'secure').";
  if (x?.code === "ENOTFOUND" || x?.code === "EDNS") return "The mail server name could not be found.";
  if (x?.code === "ETLS" || /tls|ssl|certificate/i.test(x?.message ?? "")) return "The secure connection to the mail server failed. Check the port and the 'secure' setting.";
  return (x?.message ?? "Unknown mail error").replace(/\s+/g, " ").slice(0, 200);
}
