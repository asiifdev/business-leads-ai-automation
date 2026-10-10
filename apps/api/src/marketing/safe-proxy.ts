import * as dns from "node:dns";
import * as http from "node:http";
import * as net from "node:net";
import type { Duplex } from "node:stream";
import { isBlockedAddress } from "./url-fetch";

const IDLE_MS = 30_000;
const MAX_CONNECTIONS = 64;

/** The address a host resolves to, only when every answer is public. The caller connects to THIS address, so there is no second lookup to race. */
export async function resolvePublic(host: string): Promise<string | null> {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (net.isIP(h)) return isBlockedAddress(h) ? null : h;
  try {
    const addrs = await dns.promises.lookup(h, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isBlockedAddress(a.address))) return null;
    return addrs[0].address;
  } catch {
    return null;
  }
}

function deny(socket: Duplex, status = "403 Forbidden") {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/**
 * A tiny forward proxy for the page-rendering browser. A browser resolves names by itself, so checking a host
 * before the browser connects leaves a window for DNS rebinding (a name that answers "public" first and
 * "127.0.0.1" a moment later). Here the name is resolved once, checked, and the connection is made to the checked
 * address, for plain HTTP and for HTTPS tunnels (CONNECT; nothing is decrypted). Only ports 80 and 443 are allowed.
 */
export class SafeProxy {
  private server: http.Server | null = null;
  private port = 0;

  async start(): Promise<number> {
    if (this.server) return this.port;
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url ?? "");
        if (u.protocol !== "http:" || (u.port && u.port !== "80")) return deny(res.socket!);
        const ip = await resolvePublic(u.hostname);
        if (!ip) return deny(res.socket!);
        const upstream = http.request({ host: ip, port: 80, method: req.method, path: `${u.pathname}${u.search}`, headers: { ...req.headers, host: u.host }, timeout: IDLE_MS }, (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        });
        upstream.on("timeout", () => upstream.destroy());
        upstream.on("error", () => deny(res.socket!, "502 Bad Gateway"));
        req.pipe(upstream);
      } catch {
        deny(res.socket!, "400 Bad Request");
      }
    });
    server.on("connect", async (req, client: Duplex, head: Buffer) => {
      const [host, portText] = (req.url ?? "").split(":");
      const port = Number(portText);
      if (!host || (port !== 443 && port !== 80)) return deny(client);
      const ip = await resolvePublic(host);
      if (!ip) return deny(client);
      const upstream = net.connect({ host: ip, port }, () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.setTimeout(IDLE_MS, () => upstream.destroy());
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
    });
    server.maxConnections = MAX_CONNECTIONS;
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    this.server = server;
    this.port = (server.address() as net.AddressInfo).port;
    return this.port;
  }

  async close() {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = null;
  }
}
