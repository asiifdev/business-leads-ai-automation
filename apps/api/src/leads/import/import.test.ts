import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { detectDelimiter, ImportError, MAX_IMPORT_ROWS, parseCsv } from "./csv";
import { xlsxToRows } from "./xlsx";
import { detectMapping, parseMapping, rowsToLeads } from "./lead-import";

test("csv: quotes, doubled quotes, line breaks inside cells, CRLF and a byte-order mark", () => {
  const rows = parseCsv('﻿Nama,Alamat\r\n"Toko ""Maju"", Jaya","Jl. Mawar 1\nBandung"\r\n\r\nWarung Dua,Jl. Melati 2\r\n');
  assert.deepEqual(rows, [["Nama", "Alamat"], ['Toko "Maju", Jaya', "Jl. Mawar 1\nBandung"], ["Warung Dua", "Jl. Melati 2"]]);
});

test("csv: semicolon and tab files (Excel in Indonesia) are read", () => {
  assert.equal(detectDelimiter("Nama;Telepon;Alamat\n"), ";");
  assert.equal(detectDelimiter("Nama\tTelepon\n"), "\t");
  assert.equal(detectDelimiter('"a,b,c",d\n'), ",");
  assert.deepEqual(parseCsv("Nama;Telepon\nToko A;0812\n"), [["Nama", "Telepon"], ["Toko A", "0812"]]);
});

test("csv: a last line without a newline, and an unclosed quote, do not lose or hang", () => {
  assert.deepEqual(parseCsv("a,b\nc,d"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parseCsv('a,b\n"c,d'), [["a", "b"], ["c,d"]]);
  assert.deepEqual(parseCsv(""), []);
});

test("csv: hard limits on size, rows, columns and cell length", () => {
  assert.throws(() => parseCsv("x".repeat(5_000_001)), ImportError);
  assert.throws(() => parseCsv("h\n" + "a\n".repeat(MAX_IMPORT_ROWS + 5)), /more than 2000 rows/);
  assert.equal(parseCsv(Array.from({ length: 200 }, (_, i) => `c${i}`).join(","))[0].length, 60);
  assert.equal(parseCsv("x".repeat(100_000))[0][0].length, 2000);
});

test("csv: hostile input stays fast", () => {
  const t = Date.now();
  parseCsv('"'.repeat(1_000_000));
  parseCsv(",".repeat(1_000_000));
  parseCsv('"a""'.repeat(200_000));
  parseCsv("\r".repeat(1_000_000));
  assert.ok(Date.now() - t < 2000, `took ${Date.now() - t} ms`);
});

function xlsx(sheet: string, strings: string[] = [], extra: Record<string, string> = {}) {
  const si = strings.map((s) => `<si><t>${s}</t></si>`).join("");
  return Buffer.from(zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="x"><sheets><sheet name="Data" sheetId="1" r:id="rId9"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId9" Type="x" Target="worksheets/sheet2.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8(`<sst>${si}</sst>`),
    "xl/worksheets/sheet2.xml": strToU8(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
    "xl/worksheets/sheet1.xml": strToU8("<worksheet><sheetData><row><c r=\"A1\" t=\"inlineStr\"><is><t>WRONG</t></is></c></row></sheetData></worksheet>"),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)])),
  }));
}

test("xlsx: the workbook's first sheet, shared and inline strings, numbers without exponents, gaps and entities", () => {
  const rows = xlsxToRows(xlsx(
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2" t="inlineStr"><is><t>Toko &amp; Kopi</t></is></c><c r="B2"><v>8.12345678901E+11</v></c><c r="C2"><v>5</v></c></row>' +
    '<row r="3"></row>',
    ["Nama", "Telepon"],
  ));
  assert.deepEqual(rows, [["Nama", "", "Telepon"], ["Toko & Kopi", "812345678901", "5"]]);
});

test("xlsx: not a spreadsheet, a missing sheet and an oversized part are refused", () => {
  assert.throws(() => xlsxToRows(Buffer.from("not a zip")), /not a valid \.xlsx/);
  assert.throws(() => xlsxToRows(Buffer.from(zipSync({ "readme.txt": strToU8("x") }))), /no sheet/);
  assert.throws(() => xlsxToRows(xlsx("", [], { "xl/worksheets/big.xml": "x".repeat(21_000_000) })), /too large/);
});

test("xlsx: hostile xml stays fast", () => {
  const t = Date.now();
  xlsxToRows(xlsx("<row>".repeat(100_000) + "<c ".repeat(100_000) + '<c r="A1"'.repeat(50_000)));
  assert.ok(Date.now() - t < 3000, `took ${Date.now() - t} ms`);
});

test("columns are found from English and Indonesian headings", () => {
  const m = detectMapping(["No", "Nama Usaha", "No. HP / WA", "Alamat Lengkap", "Kota", "Email", "Situs Web", "Jenis Usaha", "Latitude", "Longitude"]);
  assert.deepEqual(m, { name: 1, phone: 2, email: 5, website: 6, address: 3, category: 7, city: 4, lat: 8, lng: 9 });
  const en = detectMapping(["Business Name", "Phone", "Website"]);
  assert.equal(en.name, 0); assert.equal(en.phone, 1); assert.equal(en.website, 2); assert.equal(en.email, null);
});

test("a chosen mapping must stay inside the file and use each column once", () => {
  assert.equal(parseMapping({ name: 0, phone: 2 }, 3).phone, 2);
  assert.throws(() => parseMapping({ name: 5 }, 3), /not in the file/);
  assert.throws(() => parseMapping({ name: 1, phone: 1 }, 3), /two different fields/);
  assert.throws(() => parseMapping({ name: "0" }, 3), /not in the file/);
  assert.equal(parseMapping(null, 3).name, null);
});

test("rows become leads; bad values are dropped and counted", () => {
  const rows = [
    ["Nama", "HP", "Email", "Web", "Alamat", "Kota"],
    ["Contoh Kopi", "0812-0000-1111", "Halo@Contoh.example.com", "contoh.example.com", "Jl. Mawar 1", "Bandung"],
    ["", "0812-0000-2222", "", "", "", ""],
    ["Salah Isi", "bukan nomor", "bukan email", "bukan web", "", ""],
    ["Contoh Kopi Cabang", "+62 812 0000 1111", "", "", "", ""],
    ["Tanpa Kontak", "", "", "", "Jl. X", "Solo"],
  ];
  const { leads, report } = rowsToLeads(rows, detectMapping(rows[0]), "kopi");
  assert.deepEqual(report, { rows: 5, leads: 3, noName: 1, merged: 1, badPhone: 1, badEmail: 1, badWebsite: 1, noContact: 2 });
  const kopi = leads.find((l) => l.name === "Contoh Kopi");
  assert.ok(kopi);
  assert.equal(kopi.email, "halo@contoh.example.com");
  assert.equal(kopi.website, "https://contoh.example.com/");
  assert.equal(kopi.address, "Jl. Mawar 1, Bandung");
  assert.equal(kopi.source, "csv_import");
  assert.equal(leads.find((l) => l.name === "Salah Isi")?.phone, "");
});

test("a file without a name column is refused, and too many rows too", () => {
  assert.throws(() => rowsToLeads([["HP"], ["0812"]], detectMapping(["HP"]), "x"), /business name/);
  const many = [["Nama"], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [`B${i}`])];
  assert.throws(() => rowsToLeads(many, detectMapping(["Nama"]), "x"), /more than 2000/);
});
