import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, type WASocket } from "@whiskeysockets/baileys";
import pino from "pino";
import { PrismaService } from "../prisma/prisma.service";
import { phoneFromKey } from "./phone";
import { ProviderUnavailableError, type InboundWhatsappMessage, type WaStatus, type WhatsappProvider } from "./whatsapp.provider";

interface Session {
  sock: WASocket | null;
  status: WaStatus;
  qr: string | null;
  phone: string | null;
  attempts: number;
  stopping: boolean;
}

const MAX_RECONNECTS = 8;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * WhatsApp through a linked device (Baileys). Unofficial: use a dedicated business number, never a personal one.
 * Sessions live on disk under WA_AUTH_DIR/<workspaceId>; mount that directory as a volume in production.
 */
@Injectable()
export class BaileysProvider implements WhatsappProvider, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysProvider.name);
  private readonly sessions = new Map<string, Session>();
  private inbound: ((workspaceId: string, msg: InboundWhatsappMessage) => Promise<void>) | null = null;
  private readonly authRoot: string;
  private readonly disabled: boolean;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.authRoot = config.get<string>("WA_AUTH_DIR") || join(process.cwd(), ".wa-auth");
    this.disabled = config.get<string>("WHATSAPP_DISABLED") === "true";
  }

  onInbound(handler: (workspaceId: string, msg: InboundWhatsappMessage) => Promise<void>) {
    this.inbound = handler;
  }

  /** Resume sessions that were linked before the server restarted. */
  onModuleInit() {
    if (this.disabled) return;
    setImmediate(async () => {
      try {
        const accounts = await this.prisma.whatsappAccount.findMany({ where: { status: { in: ["connected", "connecting", "qr"] } } });
        for (const a of accounts) {
          if (existsSync(join(this.authRoot, a.workspaceId, "creds.json"))) await this.connect(a.workspaceId).catch((e) => this.logger.warn(`Resume failed for ${a.workspaceId}: ${e}`));
        }
      } catch (e) {
        this.logger.warn(`Could not resume WhatsApp sessions: ${e}`);
      }
    });
  }

  async onModuleDestroy() {
    for (const s of this.sessions.values()) {
      s.stopping = true;
      s.sock?.end(undefined);
    }
  }

  state(workspaceId: string) {
    const s = this.sessions.get(workspaceId);
    return { status: s?.status ?? "disconnected", qr: s?.qr ?? null, phone: s?.phone ?? null };
  }

  async connect(workspaceId: string) {
    if (this.disabled) throw new ProviderUnavailableError("WhatsApp is disabled on this server");
    const cur = this.sessions.get(workspaceId);
    if (cur && cur.sock && cur.status !== "disconnected" && cur.status !== "logged_out") return;
    await this.start(workspaceId, cur?.attempts ?? 0);
  }

  async disconnect(workspaceId: string, opts: { logout?: boolean } = {}) {
    const s = this.sessions.get(workspaceId);
    if (s) {
      s.stopping = true;
      try {
        if (opts.logout) await s.sock?.logout();
        else s.sock?.end(undefined);
      } catch { /* socket already closed */ }
      s.sock = null;
      s.status = "disconnected";
      s.qr = null;
    }
    if (opts.logout) await rm(join(this.authRoot, workspaceId), { recursive: true, force: true });
    await this.persist(workspaceId, { status: opts.logout ? "logged_out" : "disconnected", lastError: null });
  }

  async resolve(workspaceId: string, phone: string) {
    const sock = this.live(workspaceId);
    const res = await sock.onWhatsApp(`${phone}@s.whatsapp.net`);
    const hit = res?.[0];
    return hit?.exists ? hit.jid : null;
  }

  async send(workspaceId: string, to: string, text: string, typingMs: number) {
    const sock = this.live(workspaceId);
    await sock.sendPresenceUpdate("composing", to);
    await sleep(typingMs);
    await sock.sendPresenceUpdate("paused", to);
    const sent = await sock.sendMessage(to, { text });
    if (!sent?.key?.id) throw new Error("WhatsApp did not return a message id");
    return sent.key.id;
  }

  private live(workspaceId: string): WASocket {
    const s = this.sessions.get(workspaceId);
    if (!s?.sock || s.status !== "connected") throw new ProviderUnavailableError("WhatsApp is not connected");
    return s.sock;
  }

  private async start(workspaceId: string, attempts: number) {
    const dir = join(this.authRoot, workspaceId);
    await mkdir(dir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const version = await fetchLatestBaileysVersion().then((v) => v.version).catch(() => undefined);

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      // Browsers.ubuntu keeps the normal linked-device pairing flow (the Mac/Windows tuples break QR generation).
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false, // keep phone notifications working
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    const session: Session = { sock, status: "connecting", qr: null, phone: null, attempts, stopping: false };
    this.sessions.set(workspaceId, session);
    await this.persist(workspaceId, { status: "connecting" });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (u) => {
      if (this.sessions.get(workspaceId) !== session) return; // event from a replaced socket
      void this.onConnection(workspaceId, session, u).catch((e) => this.logger.error(`connection.update failed: ${e}`));
    });
    sock.ev.on("messages.upsert", ({ messages, type }) => {
      // Metadata only (never content or numbers): enough to tell why an incoming message was or was not used.
      for (const m of messages) {
        const jid = m.key.remoteJid ?? "";
        const kind = jid.endsWith("@s.whatsapp.net") ? "phone" : jid.endsWith("@lid") ? "lid" : jid.endsWith("@g.us") ? "group" : jid.endsWith("@broadcast") ? "broadcast" : "other";
        this.logger.log(`incoming event: type=${type} fromMe=${!!m.key.fromMe} address=${kind} text=${!!(m.message?.conversation || m.message?.extendedTextMessage?.text)} phoneResolved=${!!phoneFromKey(m.key as { remoteJid?: string | null; senderPn?: string | null; participantPn?: string | null })}`);
      }
      if (type !== "notify" || this.sessions.get(workspaceId) !== session) return;
      for (const m of messages) {
        if (m.key.fromMe || !m.key.id) continue;
        const phone = phoneFromKey(m.key as { remoteJid?: string | null; senderPn?: string | null; participantPn?: string | null });
        const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? "";
        if (!phone || !text.trim() || !this.inbound) continue;
        const at = new Date(Number(m.messageTimestamp ?? 0) * 1000 || Date.now());
        this.inbound(workspaceId, { phone, text: text.trim(), id: m.key.id, at }).catch((e) => this.logger.error(`Inbound handling failed: ${e}`));
      }
    });
  }

  private async onConnection(workspaceId: string, s: Session, u: { connection?: string; qr?: string; lastDisconnect?: { error?: unknown } }) {
    if (u.qr) {
      s.status = "qr";
      s.qr = u.qr;
      await this.persist(workspaceId, { status: "qr" });
    }
    if (u.connection === "open") {
      s.status = "connected";
      s.qr = null;
      s.attempts = 0;
      s.phone = (s.sock?.user?.id ?? "").split("@")[0].split(":")[0] || null;
      await this.persist(workspaceId, { status: "connected", phone: s.phone, lastError: null });
      this.logger.log(`WhatsApp connected for workspace ${workspaceId}`);
    }
    if (u.connection === "close") {
      const code = (u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      s.sock = null;
      s.qr = null;
      if (s.stopping) return;
      if (code === DisconnectReason.loggedOut) {
        s.status = "logged_out";
        await rm(join(this.authRoot, workspaceId), { recursive: true, force: true });
        await this.persist(workspaceId, { status: "logged_out", lastError: "Logged out from the phone. Link the number again.", paused: true });
        return;
      }
      if (code === DisconnectReason.restartRequired) {
        // expected once during pairing: reconnect immediately, not counted as a failure
        await this.start(workspaceId, s.attempts);
        return;
      }
      s.attempts += 1;
      if (s.attempts > MAX_RECONNECTS) {
        s.status = "disconnected";
        await this.persist(workspaceId, { status: "disconnected", lastError: `Connection lost (code ${code ?? "unknown"}). Reconnect manually.` });
        return;
      }
      s.status = "connecting";
      await this.persist(workspaceId, { status: "connecting" });
      const delay = Math.min(60_000, 1000 * 2 ** s.attempts);
      this.logger.warn(`WhatsApp closed (code ${code}); reconnect ${s.attempts}/${MAX_RECONNECTS} in ${delay}ms`);
      setTimeout(() => {
        if (this.sessions.get(workspaceId) === s && !s.stopping) this.start(workspaceId, s.attempts).catch((e) => this.logger.error(`Reconnect failed: ${e}`));
      }, delay);
    }
  }

  private persist(workspaceId: string, data: { status?: WaStatus; phone?: string | null; lastError?: string | null; paused?: boolean }) {
    return this.prisma.whatsappAccount.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    });
  }
}
