import test from "node:test";
import assert from "node:assert/strict";
import { detectOfferKind } from "./offer-kind";

test("an agency that builds to order is a service", () => {
  assert.equal(detectOfferKind("We build custom software solutions for startups and enterprises, web, mobile, AI/ML."), "service");
  assert.equal(detectOfferKind("Kami membangun agen AI, asisten dokumen berbasis RAG, dan sistem ML prediktif. Kami juga menyediakan tim engineer outsourcing."), "service");
  assert.equal(detectOfferKind("Contoh Digital Agency: jasa pembuatan aplikasi, AI automation dan IT outsourcing."), "service");
});

test("a ready product with a trial or subscription is a product", () => {
  assert.equal(detectOfferKind("Kami membuat sistem sewa dan rental terpadu untuk semua jenis usaha. Kasir sewa, pelacakan DP, pengingat WhatsApp. Masa coba gratis, langganan bulanan."), "product");
  assert.equal(detectOfferKind(""), "product");
});
