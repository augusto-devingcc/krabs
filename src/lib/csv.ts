/**
 * Minimal RFC 4180 CSV parser / serializer.
 * Supports: quoted fields with embedded commas, embedded newlines,
 * escaped double-quotes (""). Comma as delimiter, CRLF or LF row endings.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const n = text.length;

  while (i < n) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i += 1;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i += 1;
      } else if (ch === "\r") {
        // skip; \n will close the row
        i += 1;
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
    }
  }

  // Flush trailing field/row if non-empty
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function needsQuoting(value: string): boolean {
  return /[",\r\n]/.test(value);
}

export function stringifyCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((v) => {
          if (v === null || v === undefined) return "";
          const s = typeof v === "string" ? v : String(v);
          if (needsQuoting(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(","),
    )
    .join("\n");
}

export type CsvRecord = Record<string, string>;

export function rowsToRecords(rows: string[][]): { headers: string[]; records: CsvRecord[] } {
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0]!.map((h) => h.trim());
  const records: CsvRecord[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    // skip fully-empty rows
    if (row.every((c) => c === "")) continue;
    const rec: CsvRecord = {};
    for (let c = 0; c < headers.length; c++) {
      rec[headers[c]!] = row[c] ?? "";
    }
    records.push(rec);
  }
  return { headers, records };
}
