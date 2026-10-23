/**
 * The first sheet of an .xlsx file as rows of text. An .xlsx is a zip of XML files; only the few that hold the data are unzipped,
 * each size-checked before it is expanded (so a zip bomb cannot grow), and the XML is read with plain index searches, never with a
 * pattern that could backtrack.
 */
import { unzipSync } from "fflate";
import { ImportError, MAX_CELL_CHARS, MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "./csv";

const MAX_PART_BYTES = 20_000_000;
const MAX_TOTAL_BYTES = 40_000_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-z]{2,4});/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e] ?? m;
  });
}

/** All `<tag ...>content</tag>` blocks in order, found by index search. */
function blocks(xml: string, tag: string, max = Infinity): { attrs: string; body: string }[] {
  const out: { attrs: string; body: string }[] = [];
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let from = 0;
  while (out.length < max) {
    const s = xml.indexOf(open, from);
    if (s < 0) break;
    const after = xml[s + open.length];
    if (after !== " " && after !== ">" && after !== "/") { from = s + open.length; continue; }
    const gt = xml.indexOf(">", s);
    if (gt < 0) break;
    const attrs = xml.slice(s + open.length, gt);
    if (attrs.endsWith("/")) { out.push({ attrs, body: "" }); from = gt + 1; continue; }
    const e = xml.indexOf(close, gt);
    if (e < 0) break;
    out.push({ attrs, body: xml.slice(gt + 1, e) });
    from = e + close.length;
  }
  return out;
}

function attr(attrs: string, name: string): string | null {
  const key = ` ${name}="`;
  const i = attrs.indexOf(key);
  if (i < 0) return null;
  const j = attrs.indexOf('"', i + key.length);
  return j < 0 ? null : attrs.slice(i + key.length, j);
}

/** "AB12" -> 27 (zero-based column). */
function columnIndex(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Text of every <t> inside a block (shared strings and inline strings can be split into rich-text runs). */
function textOf(body: string): string {
  return blocks(body, "t").map((b) => decode(b.body)).join("");
}

/** A numeric cell as Excel shows it for phone numbers: no exponent, no ".0". */
function plainNumber(v: string): string {
  if (!/[eE]/.test(v) && !v.includes(".")) return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return Number.isInteger(n) ? n.toFixed(0) : String(n);
}

export function xlsxToRows(buffer: Buffer): string[][] {
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => {
        if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name)) return false;
        total += f.originalSize;
        if (f.originalSize > MAX_PART_BYTES || total > MAX_TOTAL_BYTES) throw new ImportError("The spreadsheet is too large once opened.");
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError("That file is not a valid .xlsx spreadsheet.");
  }
  const read = (name: string) => (files[name] ? new TextDecoder().decode(files[name]) : "");

  // The first sheet in the workbook's own order, falling back to the first file.
  let sheetPath = "";
  const wb = blocks(read("xl/workbook.xml"), "sheet", 1)[0];
  const rid = wb ? attr(wb.attrs, "r:id") : null;
  if (rid) {
    for (const rel of blocks(read("xl/_rels/workbook.xml.rels"), "Relationship")) {
      if (attr(rel.attrs, "Id") === rid) {
        const target = attr(rel.attrs, "Target") ?? "";
        sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      }
    }
  }
  if (!files[sheetPath]) sheetPath = Object.keys(files).filter((n) => n.startsWith("xl/worksheets/")).sort()[0] ?? "";
  if (!sheetPath) throw new ImportError("That spreadsheet has no sheet.");

  const shared = blocks(read("xl/sharedStrings.xml"), "si").map((b) => textOf(b.body));
  const rows: string[][] = [];
  for (const r of blocks(read(sheetPath), "row")) {
    if (rows.length > MAX_IMPORT_ROWS) throw new ImportError(`The sheet has more than ${MAX_IMPORT_ROWS} rows. Split it and import the parts one by one.`);
    const cells: string[] = [];
    for (const c of blocks(r.body, "c")) {
      const ref = attr(c.attrs, "r");
      const col = ref ? columnIndex(ref) : cells.length;
      if (col < 0 || col >= MAX_IMPORT_COLUMNS) continue;
      const type = attr(c.attrs, "t");
      let value = "";
      if (type === "inlineStr") value = textOf(c.body);
      else {
        const v = blocks(c.body, "v", 1)[0]?.body ?? "";
        value = type === "s" ? (shared[Number(v)] ?? "") : type === "str" || type === "b" || type === "e" ? decode(v) : plainNumber(decode(v));
      }
      while (cells.length < col) cells.push("");
      cells[col] = value.slice(0, MAX_CELL_CHARS);
    }
    if (cells.some((x) => x.trim() !== "")) rows.push(cells);
  }
  return rows;
}
