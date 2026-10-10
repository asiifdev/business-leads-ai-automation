import { Controller, Get, Header, HttpCode, Param, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";
import { verifyUnsubscribe } from "./email-utils";

const page = (title: string, body: string, form = "") =>
  `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#1a1a1a}button{font:inherit;padding:.6rem 1.1rem;border:0;border-radius:.4rem;background:#1a1a1a;color:#fff;cursor:pointer}</style></head><body><h1>${title}</h1><p>${body}</p>${form}</body></html>`;

/**
 * Public (no login). The link in every email opens a confirmation page: opening it changes nothing, because mail
 * scanners and previews open links. Only the POST (the button, or a mail client's one-click unsubscribe) records the opt-out.
 */
@Controller("unsubscribe")
export class UnsubscribeController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private parse(token: string) { return verifyUnsubscribe(token, this.config.getOrThrow<string>("JWT_SECRET")); }

  @Get(":token")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  confirm(@Param("token") token: string) {
    if (!this.parse(token)) return page("Tautan tidak valid / Invalid link", "Tautan ini tidak valid atau sudah rusak. / This link is not valid.");
    return page("Berhenti menerima email? / Unsubscribe?", "Tekan tombol untuk berhenti menerima email dari pengirim ini. / Press the button to stop receiving emails from this sender.", `<form method="post" action=""><button type="submit">Berhenti / Unsubscribe</button></form>`);
  }

  @Post(":token")
  @HttpCode(200)
  @Header("Content-Type", "text/html; charset=utf-8")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async unsubscribe(@Param("token") token: string) {
    const t = this.parse(token);
    if (!t) return page("Tautan tidak valid / Invalid link", "Tautan ini tidak valid. / This link is not valid.");
    await this.prisma.emailOptOut.upsert({
      where: { workspaceId_email: { workspaceId: t.workspaceId, email: t.email } },
      create: { workspaceId: t.workspaceId, email: t.email, reason: "unsubscribe link" },
      update: {},
    });
    // anything still waiting for this address is withdrawn
    await this.prisma.outboundMessage.updateMany({ where: { workspaceId: t.workspaceId, channel: "email", toEmail: t.email, status: { in: ["draft", "approved"] } }, data: { status: "cancelled", error: "Recipient opted out" } });
    return page("Anda sudah berhenti / You are unsubscribed", "Kami tidak akan mengirim email lagi ke alamat ini. / We will not email this address again.");
  }
}
