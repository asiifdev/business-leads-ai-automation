import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { chromium, type Browser } from "playwright";
import { SafeProxy } from "./safe-proxy";
import { hostIsPublic, validatePublicUrl } from "./url-fetch";

const NAV_TIMEOUT_MS = 20_000;
const SETTLE_MS = 6_000;
const MAX_CONCURRENT = 2;

/**
 * Renders a page in the same headless Chromium that the Google Maps scraper uses, so sites that build their content
 * with JavaScript can be read too. A page chosen by a user can ask the browser to call internal addresses, so every
 * request the page makes is checked and anything that does not resolve to a public address is aborted. All traffic
 * goes through SafeProxy, which resolves each name once and connects to the checked address, so DNS rebinding cannot
 * swap in a private address between the check and the connection.
 *
 * Chromium's sandbox stays ON unless PLAYWRIGHT_NO_SANDBOX=true (needed inside most containers, where user
 * namespaces are unavailable). This browser opens pages chosen by users, so the sandbox is not optional elsewhere.
 */
@Injectable()
export class PageRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(PageRenderer.name);
  private browser: Browser | null = null;
  private readonly proxy = new SafeProxy();
  private running = 0;
  private readonly waiters: (() => void)[] = [];

  async onModuleDestroy() {
    await this.browser?.close().catch(() => undefined);
    await this.proxy.close().catch(() => undefined);
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      const port = await this.proxy.start();
      const noSandbox = process.env.PLAYWRIGHT_NO_SANDBOX === "true";
      this.browser = await chromium.launch({
        headless: true,
        // "<-loopback>" sends even localhost requests through the proxy (Chromium would bypass it by default), where they are refused
        proxy: { server: `http://127.0.0.1:${port}`, bypass: "<-loopback>" },
        args: [...(noSandbox ? ["--no-sandbox", "--disable-setuid-sandbox"] : []), "--disable-dev-shm-usage", "--disable-gpu"],
      });
    }
    return this.browser;
  }

  private async acquire() {
    if (this.running >= MAX_CONCURRENT) await new Promise<void>((r) => this.waiters.push(r));
    this.running++;
  }
  private release() {
    this.running--;
    this.waiters.shift()?.();
  }

  /** Returns the HTML after scripts have run, and the final URL. Throws if the page cannot be opened safely. */
  async render(rawUrl: string): Promise<{ html: string; url: string }> {
    const start = validatePublicUrl(rawUrl);
    await this.acquire();
    const context = await (await this.getBrowser()).newContext({
      userAgent: "Mozilla/5.0 (compatible; ProspexBot/1.0; +https://github.com/asiifdev/business-leads-ai-automation)",
      serviceWorkers: "block",
      viewport: { width: 1280, height: 800 },
    });
    const verdicts = new Map<string, Promise<boolean>>();
    const allowed = (host: string) => {
      if (!verdicts.has(host)) verdicts.set(host, hostIsPublic(host));
      return verdicts.get(host)!;
    };
    try {
      await context.route("**/*", async (route) => {
        const req = route.request();
        let u: URL;
        try {
          u = new URL(req.url());
        } catch {
          return route.abort();
        }
        if (!/^https?:$/.test(u.protocol)) return route.abort();
        if (["image", "media", "font"].includes(req.resourceType())) return route.abort(); // text only: faster, and less to go wrong
        if (!(await allowed(u.hostname))) return route.abort("blockedbyclient");
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(start.toString(), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      await page.waitForLoadState("networkidle", { timeout: SETTLE_MS }).catch(() => undefined);
      const finalUrl = new URL(page.url());
      if (!(await allowed(finalUrl.hostname))) throw new Error("final address not allowed");
      return { html: await page.content(), url: finalUrl.toString() };
    } finally {
      await context.close().catch(() => undefined);
      this.release();
    }
  }
}
