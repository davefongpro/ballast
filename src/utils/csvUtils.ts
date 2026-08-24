import Papa from 'papaparse';
import type { Idea, Measure, Theme, Tag, Priority } from '../types';
import { TAG_COLORS } from './tagColors';
import { sanitizeCell, unsanitizeCell } from './sanitize';
import { makeId } from './ids';
import { safeExtent, checkGridSize } from './limits';

const VALID_PRIORITIES = new Set<Priority>(['now', 'next', 'later', 'not-planned']);

export interface ImportResult {
  ideas: Idea[];
  errors: string[];
  newMeasureNames: string[];
  newMeasures: Measure[];
  themes: Theme[];
  tags: Tag[];
}

export function exportCSV(ideas: Idea[], measures: Measure[], themes: Theme[], tags: Tag[]): string {
  const headers = [
    'id', 'name', 'description', 'comments',
    'Priority',
    ...measures.map(m => m.name),
    ...themes.map(t => t.name),
    'Shortlisted',
  ];
  const rows = ideas.map(idea => [
    idea.id,
    idea.name,
    idea.description,
    idea.comments,
    idea.priority ?? 'not-planned',
    ...measures.map(m => idea.values[m.id] ?? ''),
    ...themes.map(t => {
      const tagId = idea.tagsByTheme?.[t.id];
      if (!tagId) return '';
      return tags.find(tag => tag.id === tagId)?.label ?? '';
    }),
    idea.shortlisted ? 'true' : '',
  ]);
  // Every cell is neutralised before it leaves the app: an exported file is opened
  // in Excel or Sheets, where a leading '=' would be run as a formula.
  const safe = [headers, ...rows].map(row => row.map(sanitizeCell));
  return Papa.unparse(safe);
}

export function downloadCSV(content: string, filename = 'ballast.csv') {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(
  csvText: string,
  existingMeasures: Measure[],
  existingThemes: Theme[],
  existingTags: Tag[],
): ImportResult {
  const result = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true });
  const errors: string[] = [];
  const newMeasureNames: string[] = [];

  if (result.errors.length > 0) {
    return { ideas: [], errors: result.errors.map(e => e.message), newMeasureNames: [], newMeasures: [], themes: existingThemes, tags: existingTags };
  }

  const rows = (result.data as string[][]).map(row => row.map(unsanitizeCell));
  const widest = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const sizeError = checkGridSize(rows.length, widest);
  if (sizeError) {
    return { ideas: [], errors: [sizeError], newMeasureNames: [], newMeasures: [], themes: existingThemes, tags: existingTags };
  }
  if (rows.length < 2) {
    return { ideas: [], errors: ['CSV has no data rows.'], newMeasureNames: [], newMeasures: [], themes: existingThemes, tags: existingTags };
  }

  const headers = rows[0].map(h => h.trim());
  const measureByName = new Map(existingMeasures.map(m => [m.name.toLowerCase(), m]));

  // Working copies of themes and tags — augmented with auto-created entries
  const themes: Theme[] = [...existingThemes];
  const tags: Tag[] = [...existingTags];
  const themeByName = new Map(themes.map(t => [t.name.toLowerCase(), t]));

  interface MeasureCol { name: string; colIndex: number; measure: Measure }
  interface ThemeCol { name: string; colIndex: number; theme: Theme }

  const measureCols: MeasureCol[] = [];
  const themeCols: ThemeCol[] = [];
  const newMeasures: Measure[] = [];

  let shortlistedColIndex = -1;
  let priorityColIndex = -1;

  headers.slice(4).forEach((h, i) => {
    const colIndex = i + 4;
    const nameLower = h.toLowerCase();

    if (nameLower === 'priority') {
      priorityColIndex = colIndex;
    } else if (nameLower === 'shortlisted') {
      shortlistedColIndex = colIndex;
    } else if (measureByName.has(nameLower)) {
      measureCols.push({ name: h, colIndex, measure: measureByName.get(nameLower)! });
    } else if (themeByName.has(nameLower)) {
      themeCols.push({ name: h, colIndex, theme: themeByName.get(nameLower)! });
    } else {
      // Determine if it looks like a theme column (non-numeric values) or a measure column
      const colValues = rows.slice(1).map(r => (r[colIndex] || '').trim()).filter(v => v !== '');
      const allNumeric = colValues.length === 0 || colValues.every(v => !isNaN(Number(v)));
      if (allNumeric) {
        newMeasureNames.push(h);
        const nums = colValues.map(Number).filter(n => !isNaN(n));
        const extent = safeExtent(nums);
        const dataMin = extent ? extent.min : 1;
        const dataMax = extent ? extent.max : 10;
        const createdMeasure: Measure = {
          id: makeId('m-imported'),
          name: h,
          type: 'directional',
          min: Math.min(1, dataMin),
          max: Math.max(10, dataMax),
          goodEnd: 'high',
          goodDefinition: '',
        };
        newMeasures.push(createdMeasure);
        measureCols.push({ name: h, colIndex, measure: createdMeasure });
      } else {
        // Auto-create as a new theme
        const newTheme: Theme = { id: makeId('th'), name: h };
        themes.push(newTheme);
        themeByName.set(nameLower, newTheme);
        themeCols.push({ name: h, colIndex, theme: newTheme });
      }
    }
  });

  const ideas: Idea[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = (row[1] || '').trim();
    if (!name) {
      errors.push(`Row ${r + 1}: missing idea name, skipped.`);
      continue;
    }

    const values: Record<string, number> = {};
    measureCols.forEach(col => {
      const raw = row[col.colIndex];
      const num = parseInt(raw, 10);
      if (isNaN(num)) {
        if (raw && raw.trim()) {
          errors.push(`Row ${r + 1}, "${col.name}": "${raw}" is not a number, skipped.`);
        }
        return;
      }
      values[col.measure.id] = Math.max(col.measure.min, Math.min(col.measure.max, num));
    });

    const tagsByTheme: Record<string, string | null> = {};
    themeCols.forEach(col => {
      const label = (row[col.colIndex] || '').trim();
      if (!label) {
        tagsByTheme[col.theme.id] = null;
        return;
      }
      // Find or auto-create the tag
      let tag = tags.find(t => t.themeId === col.theme.id && t.label.toLowerCase() === label.toLowerCase());
      if (!tag) {
        const existingCount = tags.filter(t => t.themeId === col.theme.id).length;
        tag = {
          id: makeId('tag'),
          themeId: col.theme.id,
          label,
          color: TAG_COLORS[existingCount % TAG_COLORS.length],
        };
        tags.push(tag);
      }
      tagsByTheme[col.theme.id] = tag.id;
    });

    const shortlistedRaw = shortlistedColIndex >= 0 ? (row[shortlistedColIndex] || '').trim().toLowerCase() : '';
    const shortlisted = ['true', '1', 'yes'].includes(shortlistedRaw) ? true : undefined;

    const priorityRaw = priorityColIndex >= 0 ? (row[priorityColIndex] || '').trim() as Priority : 'not-planned';
    const priority: Priority = VALID_PRIORITIES.has(priorityRaw) ? priorityRaw : 'not-planned';

    ideas.push({
      id: row[0]?.trim() || makeId('i-imported'),
      name,
      description: (row[2] || '').trim(),
      comments: (row[3] || '').trim(),
      values,
      tagsByTheme,
      shortlisted,
      priority,
    });
  }

  return { ideas, errors, newMeasureNames, newMeasures, themes, tags };
}

/**
 * A blank CSV in exactly the shape the importer expects, so a user can fill it in
 * a spreadsheet and paste or import it back without guessing at column names.
 * Two example rows show the accepted values rather than describing them in prose.
 */
export function templateCSV(measures: Measure[], themes: Theme[]): string {
  const headers = ['id', 'name', 'description', 'comments', 'Priority', ...measures.map(m => m.name), ...themes.map(t => t.name), 'Shortlisted'];
  const mid = (m: Measure) => String(Math.round((m.min + m.max) / 2));
  const example = (name: string, priority: string) => [
    '', name, 'What it is, in a line', 'Anything worth remembering', priority,
    ...measures.map(mid), ...themes.map(() => ''), '',
  ];
  const guide = [
    '', 'Delete these two rows before importing', 'Leave id blank for new ideas', '', 'now | next | later | not-planned',
    ...measures.map(m => `${m.min}-${m.max}`), ...themes.map(() => 'any label'), 'true or blank',
  ];
  return Papa.unparse([headers, example('Example idea', 'now'), guide].map(row => row.map(sanitizeCell)));
}
