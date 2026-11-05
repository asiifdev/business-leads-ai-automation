import test from "node:test";
import assert from "node:assert/strict";
import { outreachProblems } from "./outreach-check";

const ok = "Halo, Kak. Perkenalkan saya dari Contoh Digital Agency, bergerak di bidang pembuatan aplikasi, otomatisasi AI, dan IT outsourcing. Apabila di usaha Kakak ada kebutuhan terkait sistem atau digitalisasi, kami terbuka untuk konsultasi. Terima kasih.";

test("a complete service introduction passes", () => {
  assert.deepEqual(outreachProblems(ok, { service: true }), []);
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

test("a stub is rejected", () => {
  assert.match(outreachProblems("Halo, Kak.", { service: false }).join(" "), /terlalu pendek/);
});
