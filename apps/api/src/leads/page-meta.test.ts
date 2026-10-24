import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, extractBusinessInfo, mergeBusinessInfo, readPageMeta } from "./page-meta";
import { isProfileHost, phonesFromText, platformOf, profileFromMeta } from "./profile-meta";

const IG = `<html><head><meta property="og:title" content="Contoh Kopi (&#064;contohkopi) &#x2022; Instagram photos and videos" />
<meta property="og:description" content="1,2K Followers, 10 Following, 80 Posts - See Instagram photos and videos from Contoh Kopi (&#064;contohkopi)" />
<meta content="1,2K Followers, 10 Following, 80 Posts - Contoh Kopi (&#064;contohkopi) on Instagram: &quot;Kopi susu &amp; roti. Buka 08.00-21.00. Pesan: 0812-3456-7890&quot;" name="description" /></head></html>`;
const FB = `<head><meta property="og:title" content="Contoh Bengkel" /><meta property="og:description" content="Contoh Bengkel. 1.200 pengikut &#xb7; 35 membicarakan ini. Servis motor dan mobil. WA 0812 3456 7890" /></head>`;

test("entities are decoded, bad ones are left", () => {
  assert.equal(decodeEntities("A &amp; B &#064; &#x1f30e; &bogus; &#9999999;"), "A & B @ \u{1f30e} &bogus; ");
});

test("meta, og tags, title and json-ld are read from a page head", () => {
  const html = `<title> Toko  Contoh </title><meta name="description" content="Menjual kamera"><meta property='og:site_name' content='Contoh'><script type="application/ld+json">{"@type":"Store","name":"x"}</script><script type="application/ld+json">{broken</script>`;
  const m = readPageMeta(html);
  assert.equal(m.title, "Toko Contoh");
  assert.equal(m.description, "Menjual kamera");
  assert.equal(m.og.site_name, "Contoh");
  assert.equal(m.jsonld.length, 1);
});

test("business details come only from what the page states", () => {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "x" },
      {
        "@type": ["Restaurant", "Thing"], description: "Masakan Padang sejak 1990.", telephone: "+62 812-3456-7890; +62 22 555 000",
        email: "mailto:Halo@Contoh.example.com", address: { streetAddress: "Jl. Mawar 5", addressLocality: "Bandung", postalCode: "40111" },
        openingHoursSpecification: [{ dayOfWeek: ["https://schema.org/Monday", "Tuesday"], opens: "08:00", closes: "21:00" }],
        priceRange: "$$", sameAs: ["https://instagram.com/contoh", "javascript:alert(1)"],
      },
    ],
  };
  const info = extractBusinessInfo(readPageMeta(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`));
  assert.equal(info.type, "Restaurant");
  assert.equal(info.description, "Masakan Padang sejak 1990.");
  assert.deepEqual(info.phones, ["6281234567890"]);
  assert.deepEqual(info.emails, ["halo@contoh.example.com"]);
  assert.equal(info.address, "Jl. Mawar 5, Bandung, 40111");
  assert.equal(info.hours, "Monday/Tuesday 08:00-21:00");
  assert.deepEqual(info.sameAs, ["https://instagram.com/contoh"]);
});

test("without json-ld the meta description is the only detail; with nothing there is nothing", () => {
  assert.deepEqual(extractBusinessInfo(readPageMeta('<meta name="description" content="Bengkel motor">')), { description: "Bengkel motor", phones: [], emails: [], sameAs: [] });
  assert.deepEqual(extractBusinessInfo(readPageMeta("<p>nothing</p>")), { phones: [], emails: [], sameAs: [] });
});

test("details from several pages merge, the first page winning", () => {
  const m = mergeBusinessInfo([{ description: "A", phones: ["1"], emails: [], sameAs: [] }, { description: "B", hours: "H", phones: ["1", "2"], emails: [], sameAs: [] }]);
  assert.equal(m.description, "A");
  assert.equal(m.hours, "H");
  assert.deepEqual(m.phones, ["1", "2"]);
});

test("hostile pages stay fast", () => {
  const t = Date.now();
  readPageMeta("<meta ".repeat(200_000));
  readPageMeta('<meta content="'.repeat(100_000));
  readPageMeta('<script type="application/ld+json">'.repeat(100_000));
  extractBusinessInfo(readPageMeta(`<script type="application/ld+json">${"[".repeat(100_000)}</script>`));
  extractBusinessInfo({ title: "", description: "", og: {}, tags: {}, jsonld: [Array.from({ length: 5000 }, () => ({ "@type": "Store", telephone: "0812" }))] });
  assert.ok(Date.now() - t < 3000, `took ${Date.now() - t} ms`);
});

test("platforms and profile hosts", () => {
  assert.equal(platformOf("https://www.instagram.com/contoh/"), "instagram");
  assert.equal(platformOf("facebook.com/contoh"), "facebook");
  assert.equal(platformOf("https://tiktok.com/@contoh"), null);
  assert.equal(platformOf("https://contoh.example.com"), null);
  assert.equal(isProfileHost("https://instagram.com/x"), true);
  assert.equal(isProfileHost("https://linktr.ee/x"), true);
  assert.equal(isProfileHost("https://contoh.example.com"), false);
  assert.equal(isProfileHost(""), false);
});

test("an Instagram preview gives the name and the bio", () => {
  const p = profileFromMeta("instagram", readPageMeta(IG));
  assert.equal(p?.name, "Contoh Kopi");
  assert.equal(p?.bio, "Kopi susu & roti. Buka 08.00-21.00. Pesan: 0812-3456-7890");
});

test("a Facebook preview gives the name and the bio after the counts", () => {
  const p = profileFromMeta("facebook", readPageMeta(FB));
  assert.equal(p?.name, "Contoh Bengkel");
  assert.equal(p?.bio, "Servis motor dan mobil. WA 0812 3456 7890");
});

test("a login wall or a missing page is not a profile", () => {
  assert.equal(profileFromMeta("instagram", readPageMeta('<meta property="og:title" content="Instagram" /><meta name="description" content="Create an account or log in to Instagram" />')), null);
  assert.equal(profileFromMeta("facebook", readPageMeta('<meta property="og:title" content="Facebook" />')), null);
  assert.equal(profileFromMeta("facebook", readPageMeta('<meta property="og:title" content="Masuk atau daftar untuk melihat" />')), null);
  assert.equal(profileFromMeta("instagram", readPageMeta("")), null);
});

test("mobile numbers are found in running text in their usual writings", () => {
  assert.deepEqual(phonesFromText("WA 0812-3456-7890 atau +62 813 4567 8901, telp kantor 022-555-000"), ["6281234567890", "6281345678901"]);
  assert.deepEqual(phonesFromText("hubungi 6281234567890"), ["6281234567890"]);
  assert.deepEqual(phonesFromText("tahun 2024, harga 150000, no 12345"), []);
  const t = Date.now();
  phonesFromText("0".repeat(100000) + "8".repeat(100000));
  assert.ok(Date.now() - t < 500);
});
