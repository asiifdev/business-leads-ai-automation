import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteDomain, nameKey, findDuplicate, distanceM } from "./dedupe";

test("websiteDomain reduces a website to its domain and ignores shared hosts", () => {
  assert.equal(websiteDomain("https://www.Example.com/menu?x=1"), "example.com");
  assert.equal(websiteDomain("contoh-bisnis.co.id"), "contoh-bisnis.co.id");
  assert.equal(websiteDomain("https://instagram.com/contoh"), null);
  assert.equal(websiteDomain("https://shop.linktr.ee/contoh"), null);
  assert.equal(websiteDomain("https://x.example.com"), "x.example.com");
  assert.equal(websiteDomain("not a url"), null);
  assert.equal(websiteDomain(null), null);
});

test("nameKey ignores case, punctuation and company words", () => {
  assert.equal(nameKey("Toko Maju Jaya"), nameKey("MAJU JAYA!"));
  assert.notEqual(nameKey("Maju Jaya"), nameKey("Maju Makmur"));
});

test("findDuplicate matches on phone first, in any written form", () => {
  const existing = [{ id: "a", name: "Contoh Studio", phone: "0812-3456-7890" }];
  const r = findDuplicate({ name: "Another name", phone: "+62 812 3456 7890" }, existing);
  assert.equal(r?.match.id, "a");
  assert.equal(r?.reason, "phone");
});

test("findDuplicate matches on website domain", () => {
  const r = findDuplicate({ name: "Contoh Studio Cabang", website: "https://www.contoh.example.com/" }, [{ id: "a", name: "Contoh Studio", website: "http://contoh.example.com" }]);
  assert.equal(r?.reason, "website");
  assert.equal(findDuplicate({ name: "X", phone: "081200001111", website: "https://contoh.example.com" }, [{ id: "a", name: "Contoh Studio", website: "http://contoh.example.com" }])?.reason, "website");
});

test("branches of a chain share a website but each has its own number: they are not repeats", () => {
  const branches = [
    { id: "a", name: "KFC Cibabat", phone: "+62226645586", website: "http://www.kfcku.com/" },
    { id: "b", name: "KFC Sukawangi", phone: "+628117157173", website: "http://www.kfcku.com/" },
  ];
  assert.equal(findDuplicate({ name: "KFC Pasar Baru", phone: "+628117157188", website: "http://www.kfcku.com/" }, branches), null);
  assert.equal(findDuplicate({ name: "KFC Sukawangi (Maps)", phone: "08117157173", website: "http://www.kfcku.com/" }, branches)?.match.id, "b");
  assert.equal(findDuplicate({ name: "KFC lain", website: "http://www.kfcku.com/" }, branches)?.reason, "website");
});

test("findDuplicate: same name needs the same place, and different numbers mean separate branches", () => {
  const base = { id: "a", name: "Contoh Studio", lat: -6.2, lng: 106.8, phone: "081234567890" };
  assert.equal(findDuplicate({ name: "contoh studio", lat: -6.2001, lng: 106.8001 }, [base])?.reason, "name_place");
  assert.equal(findDuplicate({ name: "contoh studio", lat: -7.2, lng: 107.8 }, [base]), null);
  assert.equal(findDuplicate({ name: "contoh studio", lat: -6.2, lng: 106.8, phone: "081299998888" }, [base]), null);
  assert.equal(findDuplicate({ name: "contoh studio" }, [base]), null);
});

test("shared profile pages never make two businesses the same", () => {
  assert.equal(findDuplicate({ name: "A Studio", website: "https://instagram.com/a" }, [{ name: "B Studio", website: "https://instagram.com/b" }]), null);
});

test("hostile input stays fast", () => {
  const long = "a".repeat(100000);
  const many = Array.from({ length: 5000 }, (_, i) => ({ id: String(i), name: `Bisnis ${i}`, phone: `0812${String(i).padStart(8, "0")}` }));
  const t = Date.now();
  findDuplicate({ name: long, website: long + ".com", phone: long }, many);
  assert.ok(Date.now() - t < 1000);
  assert.ok(distanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }) === 0);
});

test("an index can learn leads one by one, so later ones are compared with earlier ones", async () => {
  const { createDuplicateIndex } = await import("./dedupe");
  const index = createDuplicateIndex<{ id: string; name: string; phone?: string }>([]);
  assert.equal(index.find({ name: "Contoh Studio", phone: "081234567890" }), null);
  index.add({ id: "a", name: "Contoh Studio", phone: "081234567890" });
  assert.equal(index.find({ name: "Salinan", phone: "+6281234567890" })?.match.id, "a");
});
