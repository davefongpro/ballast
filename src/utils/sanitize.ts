/**
 * Spreadsheet formula-injection neutralisation.
 *
 * A cell whose text begins with `=`, `+`, `-`, `@`, or a leading tab/CR is
 * interpreted as a formula by Excel, LibreOffice and Google Sheets when the file
 * is opened. Since this tool exports data that other people open in spreadsheets,
 * every exported cell passes through here first.
 *
 * The neutralisation is a leading apostrophe, which spreadsheets strip on display
 * and which is the convention CSV consumers expect.
 */

const RISKY_PREFIX = /^[=+\-@\t\r]/;

export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text === '') return '';
  return RISKY_PREFIX.test(text) ? `'${text}` : text;
}

/** Strip a neutralising apostrophe added on a previous export, so round-trips are stable. */
export function unsanitizeCell(value: string): string {
  return value.startsWith("'") && RISKY_PREFIX.test(value.slice(1)) ? value.slice(1) : value;
}
