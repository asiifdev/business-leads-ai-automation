import { test } from "node:test";
import assert from "node:assert/strict";
import { WebsiteListService } from "./website-list.service";
import type { FetchedResource } from "../marketing/url-fetch";

const PAGES: Record<string, string> = {
  "https://rm-contoh.co.id/": `<head><title>Beranda | RM Contoh</title><script type="application/ld+json">{"@type":"Restaurant","name":"Rumah Makan Contoh","telephone":"+62 812-3456-7001","email":"halo@rm-contoh.co.id","address":{"streetAddress":"Jl. Mawar 5","addressLocality":"Bandung"}}</script></head><body>Masakan Padang</body>`,
  "https://toko-maju.co.id/": `<head><title>Home | Toko Maju Jaya - Jual Kamera</title></head><body><p>Kontak: pesan@toko-maju.co.id, WA <a href="https://wa.me/6281234567002">chat</a></p></body>`,
  "https://parkir.co.id/": "<head><title>parkir.co.id</title></head><body>This domain is for sale. Contact the owner.</body>",
  "https://www.instagram.com/kopi.contoh/": `<head><meta property="og:title" content="Kopi Contoh (&#064;kopi.contoh) &#x2022; Instagram photos and videos" /><meta content="9 Followers, 1 Following, 3 Posts - Kopi Contoh (&#064;kopi.contoh) on Instagram: &quot;Kopi susu. WA 0812-3456-7003&quot;" name="description" /></head>`,
  "https://www.instagram.com/tertutup/": '<head><meta property="og:title" content="Instagram" /></head>',
};

function service(delay = 0) {
  const s = new WebsiteListService();
  let active = 0;
  let peak = 0;
  s.fetchPage = (async (url: string): Promise<FetchedResource> => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, delay));
    active--;
    const body = PAGES[url];
    if (body === undefined) throw new Error("could not open");
    return { url, type: "text/html", body, bytes: Buffer.from(body) } as FetchedResource;
  }) as never;
  return { s, peak: () => peak };
}

test("a website becomes a lead named by the page, with only what the page states", async () => {
  const { s } = service();
  const r = await s.read(["https://rm-contoh.co.id/", "https://toko-maju.co.id/"], "makanan");
  const byName = (n: string) => r.leads.find((l) => l.name === n);
  const rm = byName("Rumah Makan Contoh");
  assert.ok(rm);
  assert.equal(rm.phone, "+6281234567001");
  assert.equal(rm.email, "halo@rm-contoh.co.id");
  assert.equal(rm.address, "Jl. Mawar 5, Bandung");
  assert.equal(rm.category, "restaurant");
  assert.equal(rm.website, "https://rm-contoh.co.id/");
  assert.equal(rm.source, "website_list");
  assert.equal(rm.industry, "makanan");
  const maju = byName("Toko Maju Jaya");
  assert.ok(maju);
  assert.equal(maju.phone, "+6281234567002");
  assert.equal(maju.email, "pesan@toko-maju.co.id");
});

test("an Instagram page gives its name and the number written in the bio", async () => {
  const { s } = service();
  const r = await s.read(["https://www.instagram.com/kopi.contoh/"]);
  assert.equal(r.leads[0].name, "Kopi Contoh");
  assert.equal(r.leads[0].phone, "+6281234567003");
  assert.deepEqual(r.leads[0].social, { instagram: "https://www.instagram.com/kopi.contoh/" });
});

test("pages that cannot be opened, are parked, or show a login wall are named and left out, never invented", async () => {
  const { s } = service();
  const r = await s.read(["https://rm-contoh.co.id/", "https://parkir.co.id/", "https://tidak-ada.co.id/", "https://www.instagram.com/tertutup/"]);
  assert.equal(r.leads.length, 1);
  assert.deepEqual(r.parked, ["parkir.co.id"]);
  assert.deepEqual(r.unreachable.sort(), ["instagram.com", "tidak-ada.co.id"]);
});

test("pages are read a few at a time, and an empty list is fine", async () => {
  const { s, peak } = service(20);
  const urls = Array.from({ length: 20 }, (_, i) => `https://situs${i}.co.id/`);
  const r = await s.read(urls);
  assert.equal(r.unreachable.length, 20);
  assert.ok(peak() <= 5 && peak() >= 2, `peak ${peak()}`);
  assert.deepEqual(await s.read([]), { leads: [], unreachable: [], parked: [] });
});
