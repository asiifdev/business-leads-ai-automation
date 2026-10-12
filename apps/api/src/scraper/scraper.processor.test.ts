import { test } from "node:test";
import assert from "node:assert/strict";
import { leadKey } from "./scraper.processor";

test("the same business found twice is one lead: same phone in different formats, or same name and address", () => {
  const a = { name: "Rental Kamera A", address: "Jl. Mawar 1", phone: "0812-3456-7890" };
  assert.equal(leadKey(a), leadKey({ ...a, name: "RENTAL KAMERA A (cabang)", address: "Jl. Melati 2", phone: "+62 812 3456 7890" }));
  const noPhone = { name: "Toko B", address: "Jl. Kenanga 3", phone: "" };
  assert.equal(leadKey(noPhone), leadKey({ ...noPhone, name: "toko b", address: "JL. KENANGA 3" }));
  assert.notEqual(leadKey(noPhone), leadKey({ ...noPhone, address: "Jl. Kenanga 4" }));
  assert.notEqual(leadKey({ name: "x", address: "y", phone: "12" }), leadKey({ name: "x", address: "z", phone: "13" })); // short numbers are not trusted as identity
});
