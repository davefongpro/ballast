/**
 * Bounds on anything the user pastes or imports.
 *
 * Without these, a large file freezes the tab with no explanation, and an
 * unbounded `Math.min(...array)` spread overflows the call stack. Every limit
 * here produces a stated error instead.
 */

export const LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,   // 5 MB
  maxRows: 5_000,
  maxColumns: 200,
  maxCellChars: 2_000,
} as const;

export function checkFileSize(file: File): string | null {
  if (file.size > LIMITS.maxFileBytes) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${LIMITS.maxFileBytes / 1024 / 1024} MB — try exporting fewer rows.`;
  }
  return null;
}

export function checkGridSize(rowCount: number, columnCount: number): string | null {
  if (rowCount > LIMITS.maxRows) {
    return `That is ${rowCount.toLocaleString()} rows. The limit is ${LIMITS.maxRows.toLocaleString()}.`;
  }
  if (columnCount > LIMITS.maxColumns) {
    return `That is ${columnCount} columns. The limit is ${LIMITS.maxColumns}.`;
  }
  return null;
}

export function truncateCell(text: string): string {
  return text.length > LIMITS.maxCellChars ? text.slice(0, LIMITS.maxCellChars) : text;
}

/** Min/max over an array without an argument spread, which overflows the stack on large inputs. */
export function safeExtent(nums: number[]): { min: number; max: number } | null {
  if (nums.length === 0) return null;
  let min = nums[0];
  let max = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] < min) min = nums[i];
    if (nums[i] > max) max = nums[i];
  }
  return { min, max };
}
