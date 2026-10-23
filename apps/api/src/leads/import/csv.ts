/**
 * Reads a CSV file into rows of text. One linear pass over the characters, so no input can make it slow, with hard caps on size,
 * rows, columns and cell length. Handles a byte-order mark, quoted cells with commas, line breaks and doubled quotes, and
 * comma, semicolon or tab as the separator (Excel in Indonesia saves with semicolons).
 */
export const MAX_IMPORT_BYTES = 5_000_000;
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_COLUMNS = 60;
export const MAX_CELL_CHARS = 2000;

export class ImportError extends Error {}

/** Which separator the first line uses: the most frequent one outside quotes. */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < text.length && i < 20_000; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === "\n" || c === "\r")) break;
    else if (!quoted && c in counts) counts[c]++;
  }
  return counts[";"] > counts[","] && counts[";"] >= counts["\t"] ? ";" : counts["\t"] > counts[","] ? "\t" : ",";
}

export function parseCsv(input: string): string[][] {
  if (input.length > MAX_IMPORT_BYTES) throw new ImportError(`The file is larger than ${MAX_IMPORT_BYTES / 1_000_000} MB.`);
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let touched = false; // anything seen in this row, so a blank line is not a row

  const endCell = () => {
    if (row.length < MAX_IMPORT_COLUMNS) row.push(cell.length > MAX_CELL_CHARS ? cell.slice(0, MAX_CELL_CHARS) : cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (touched && row.some((c) => c.trim() !== "")) {
      if (rows.length > MAX_IMPORT_ROWS) throw new ImportError(`The file has more than ${MAX_IMPORT_ROWS} rows. Split it and import the parts one by one.`);
      rows.push(row);
    }
    row = [];
    touched = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { if (cell.length <= MAX_CELL_CHARS) cell += '"'; i++; } else quoted = false;
      } else if (cell.length <= MAX_CELL_CHARS) cell += c;
      continue;
    }
    if (c === '"' && cell === "") { quoted = true; touched = true; }
    else if (c === delimiter) { endCell(); touched = true; }
    else if (c === "\n") endRow();
    else if (c === "\r") { if (text[i + 1] === "\n") i++; endRow(); }
    else { if (cell.length <= MAX_CELL_CHARS) cell += c; touched = true; }
  }
  if (touched || cell !== "" || row.length) endRow();
  return rows;
}
