// Tables as CSV files (opens in Excel), for the reports' "Download" buttons. Pure `toCsv` is tested in Node.

type Cell = string | number | undefined | null;

/**
 * Rows → CSV text. Cells with commas, quotes or new lines are quoted. A cell that starts with = + - @ is prefixed
 * with ' so a spreadsheet shows it as text and never runs it as a formula ("CSV injection").
 */
export function toCsv(rows: Cell[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let s = cell === undefined || cell === null ? "" : String(cell);
          if (typeof cell === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
          return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/** Downloads rows as a .csv file. The mark at the start (BOM) tells Excel the text is UTF-8, so Arabic shows right. */
export function downloadCsv(fileName: string, rows: Cell[][]) {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
