// One CSV cell for spreadsheets. A leading =, +, - or @ would run as a
// formula when the file is opened, and these cells hold what visitors typed.
function toCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Semicolons and a byte order mark: what Excel expects on a French system.
export function toCsv(rows: (string | number | null)[][]) {
  return `﻿${rows.map((row) => row.map(toCell).join(";")).join("\r\n")}\r\n`;
}
