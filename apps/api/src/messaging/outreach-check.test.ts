import test from "node:test";
import assert from "node:assert/strict";
import { outreachProblems } from "./outreach-check";

const ok = "Halo, Kak. Perkenalkan saya dari Contoh Digital Agency, bergerak di bidang pembuatan aplikasi, otomatisasi AI, dan IT outsourcing. Apabila di usaha Kakak ada kebutuhan terkait sistem atau digitalisasi, kami terbuka untuk konsultasi. Terima kasih.";

test("a complete, polite service introduction passes", () => {
  assert.deepEqual(outreachProblems(ok, { service: true }), []);
});

test("a question without a question word is rejected, and with one it passes", () => {
  const without = ok.replace("Terima kasih.", "Kira-kira ada kebutuhan seperti itu di tempat Kakak?");
  assert.match(outreachProblems(without, { service: true }).join(" "), /kata tanya/);
  const withWord = ok.replace("Terima kasih.", "Kira-kira apakah ada kebutuhan seperti itu di tempat Kakak untuk saat ini?");
  assert.deepEqual(outreachProblems(withWord, { service: true }), []);
});

test("slang and vague phrases are rejected for a service", () => {
  for (const bad of ["Kalau tertarik, gimana kalau kita ngobrol sebentar?", "Kami bikin sistem buat toko.", "Kami bantu urusan bisnis pakai teknologi."]) {
    assert.notDeepEqual(outreachProblems(ok.replace("Terima kasih.", bad), { service: true }), [], bad);
  }
});

test("a demo offer is wrong for a service but fine for a product", () => {
  const demo = ok.replace("Terima kasih.", "Boleh saya kirim contoh tampilan?");
  assert.match(outreachProblems(demo, { service: true }).join(" "), /demo atau produk jadi/);
  assert.doesNotMatch(outreachProblems(demo, { service: false }).join(" "), /demo atau produk jadi/);
});

test("a client named in the brief must not be named to an unrelated shop", () => {
  const leak = ok.replace("kebutuhan terkait sistem", "kebutuhan seperti yang kami kerjakan untuk PT Klien Contoh");
  assert.match(outreachProblems(leak, { service: true, category: "Toko elektronik", caseStudies: ["PT Klien Contoh"] }).join(" "), /klien atau studi kasus/);
  assert.doesNotMatch(outreachProblems(leak, { service: true, category: "PT Klien Contoh Jaya", caseStudies: ["PT Klien Contoh"] }).join(" "), /klien atau studi kasus/);
  assert.doesNotMatch(outreachProblems(leak, { service: true, category: "Toko elektronik" }).join(" "), /klien atau studi kasus/);
});

test("jargon and a missing introduction are rejected for a service", () => {
  assert.match(outreachProblems(ok.replace("otomatisasi AI", "sistem yang berjalan di produksi"), { service: true }).join(" "), /istilah teknis/);
  assert.match(outreachProblems("Halo, Kak. Kami membuat aplikasi, website, dan otomatisasi AI untuk usaha seperti toko Kakak. Apakah ada kebutuhan itu untuk saat ini? Terima kasih.", { service: true }).join(" "), /memperkenalkan diri/);
});
