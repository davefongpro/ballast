import type { Idea, Measure } from '../types';
import { sanitizeCell } from './sanitize';

export function exportMarkdown(ideas: Idea[], measures: Measure[]): string {
  const headers = ['Name', 'Description', 'Comments', ...measures.map(m => m.name)];
  const separator = headers.map(() => '---');

  const rows = ideas.map(idea => [
    idea.name,
    idea.description,
    idea.comments,
    ...measures.map(m => String(idea.values[m.id] ?? '')),
  ]);

  // Markdown tables get pasted into wikis and back out into spreadsheets, so the
  // same formula neutralisation applied to CSV applies to content cells. The
  // separator row is table syntax, not content — sanitising its dashes would break
  // the table.
  const toRow = (cells: string[]) =>
    '| ' + cells.map(c => sanitizeCell(c).replace(/\|/g, '\\|')).join(' | ') + ' |';
  const separatorRow = '| ' + separator.join(' | ') + ' |';

  return [toRow(headers), separatorRow, ...rows.map(toRow)].join('\n');
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
