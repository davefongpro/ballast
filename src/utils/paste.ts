import type { Idea, Measure, Theme, Tag, Priority } from '../types';
import { makeId } from './ids';
import { clampToRange } from './normalize';
import { checkGridSize, truncateCell, safeExtent } from './limits';
import { unsanitizeCell } from './sanitize';
import { TAG_COLORS } from './tagColors';

/**
 * Paste-to-grid.
 *
 * The job: take whatever a spreadsheet put on the clipboard and work out what it
 * means, without committing anything until the user has seen a summary. Two shapes
 * are supported.
 *
 * - **Table paste** — the block includes a header row naming columns. Columns are
 *   matched by name to fields (Name, Description, Priority…) and to measures and
 *   themes. Rows are matched to existing ideas by id or name; anything unmatched
 *   becomes a new idea.
 * - **Block paste** — a bare rectangle of values, anchored at the focused cell and
 *   filling right and down from there, the way a spreadsheet behaves.
 *
 * Nothing here mutates state. `planPaste` returns a description of what would
 * happen; `applyPaste` turns an approved plan into new arrays.
 */

export type FieldTarget =
  | { kind: 'id' }
  | { kind: 'name' }
  | { kind: 'description' }
  | { kind: 'comments' }
  | { kind: 'priority' }
  | { kind: 'shortlisted' }
  | { kind: 'measure'; measure: Measure }
  | { kind: 'theme'; theme: Theme }
  | { kind: 'unmapped'; header: string };

export interface CellChange { label: string; from: string; to: string; }

export interface IdeaUpdate { ideaId: string; ideaName: string; changes: CellChange[]; }

export interface Rejection { where: string; reason: string; }

export interface ProposedMeasure {
  /** The pasted column header that implies it. */
  header: string;
  measure: Measure;
}

export interface PastePlan {
  mode: 'table' | 'block';
  rowCount: number;
  columnCount: number;
  newIdeas: Idea[];
  updates: IdeaUpdate[];
  rejections: Rejection[];
  unmappedColumns: string[];
  /** Columns that look like measures but have none defined yet, offered for creation. */
  proposedMeasures: ProposedMeasure[];
  placeholderNameCount: number;
  newThemes: Theme[];
  newTags: Tag[];
  newMeasures: Measure[];
  fatalError?: string;
}

const NAME_HEADERS = new Set(['name', 'idea', 'title', 'item', 'initiative']);
const DESC_HEADERS = new Set(['description', 'desc', 'detail', 'details', 'notes']);
const COMMENT_HEADERS = new Set(['comments', 'comment', 'note']);
const PRIORITY_HEADERS = new Set(['priority', 'tier', 'when']);
const SHORTLIST_HEADERS = new Set(['shortlisted', 'shortlist', 'starred']);
const ID_HEADERS = new Set(['id', 'key', 'ref']);

const PRIORITY_ALIASES: Record<string, Priority> = {
  'now': 'now', 'p0': 'now', 'this quarter': 'now', 'current': 'now',
  'next': 'next', 'p1': 'next', 'soon': 'next',
  'later': 'later', 'p2': 'later', 'someday': 'later', 'future': 'later',
  'not-planned': 'not-planned', 'not planned': 'not-planned', 'none': 'not-planned',
  'no': 'not-planned', 'backlog': 'not-planned', 'won\'t do': 'not-planned',
};

/** Split clipboard text into a rectangular grid. Tab-separated wins; comma is the fallback. */
export function parseClipboardGrid(text: string): string[][] {
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+$/, '');
  if (normalised === '') return [];
  const lines = normalised.split('\n');
  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') ? ',' : '\t');
  return lines.map(line => splitLine(line, delimiter).map(cell => truncateCell(unsanitizeCell(cell.trim()))));
}

/** Split one line, honouring double-quoted cells so a comma inside quotes stays put. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function resolveHeader(header: string, measures: Measure[], themes: Theme[]): FieldTarget {
  const h = header.trim().toLowerCase();
  if (ID_HEADERS.has(h)) return { kind: 'id' };
  if (NAME_HEADERS.has(h)) return { kind: 'name' };
  if (DESC_HEADERS.has(h)) return { kind: 'description' };
  if (COMMENT_HEADERS.has(h)) return { kind: 'comments' };
  if (PRIORITY_HEADERS.has(h)) return { kind: 'priority' };
  if (SHORTLIST_HEADERS.has(h)) return { kind: 'shortlisted' };
  const measure = measures.find(m => m.name.trim().toLowerCase() === h);
  if (measure) return { kind: 'measure', measure };
  const theme = themes.find(t => t.name.trim().toLowerCase() === h);
  if (theme) return { kind: 'theme', theme };
  return { kind: 'unmapped', header };
}

/** A first row is a header row when most of its cells name something we recognise. */
function looksLikeHeader(row: string[], measures: Measure[], themes: Theme[]): boolean {
  const nonEmpty = row.filter(c => c !== '');
  if (nonEmpty.length < 2) return false;
  const recognised = nonEmpty.filter(c => resolveHeader(c, measures, themes).kind !== 'unmapped').length;
  const hasNameColumn = nonEmpty.some(c => NAME_HEADERS.has(c.trim().toLowerCase()));
  return hasNameColumn || (recognised >= 2 && recognised >= nonEmpty.length / 2);
}

function parsePriority(raw: string): Priority | null {
  const key = raw.trim().toLowerCase();
  return PRIORITY_ALIASES[key] ?? null;
}

function blankIdea(name: string, measures: Measure[], themes: Theme[]): Idea {
  const tagsByTheme: Record<string, string | null> = {};
  themes.forEach(t => { tagsByTheme[t.id] = null; });
  const values: Record<string, number> = {};
  measures.forEach(m => { values[m.id] = Math.round((m.min + m.max) / 2); });
  return {
    id: makeId('i'),
    name,
    description: '',
    comments: '',
    values,
    tagsByTheme,
    priority: 'not-planned',
  };
}

export interface PlanArgs {
  grid: string[][];
  ideas: Idea[];
  measures: Measure[];
  /**
   * Measures the user has agreed to create as part of this paste. They are
   * planned against as if they already existed, so the preview and the commit
   * can never disagree about what a column will do.
   */
  acceptedMeasures?: Measure[];
  themes: Theme[];
  tags: Tag[];
  /** Index into `ideas` of the row the paste is anchored on (block mode only). */
  anchorRow: number;
  /** Index into `measures` of the column the paste is anchored on (block mode only). */
  anchorCol: number;
}

export function planPaste({ grid, ideas, measures, themes, tags, anchorRow, anchorCol, acceptedMeasures = [] }: PlanArgs): PastePlan {
  const empty: PastePlan = {
    mode: 'block', rowCount: 0, columnCount: 0, newIdeas: [], updates: [], rejections: [],
    unmappedColumns: [], proposedMeasures: [], placeholderNameCount: 0,
    newThemes: [], newTags: [], newMeasures: [],
  };

  if (grid.length === 0) return { ...empty, fatalError: 'The clipboard was empty.' };

  const columnCount = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const sizeError = checkGridSize(grid.length, columnCount);
  if (sizeError) return { ...empty, rowCount: grid.length, columnCount, fatalError: sizeError };

  const working = [...measures, ...acceptedMeasures];
  const isTable = looksLikeHeader(grid[0], working, themes);
  return isTable
    ? planTablePaste(grid, ideas, working, themes, tags, acceptedMeasures)
    : planBlockPaste(grid, ideas, working, themes, anchorRow, anchorCol, acceptedMeasures);
}

/**
 * Columns the paste implies but the file has no measure for. Offering to create
 * them is what removes the round trip to the Measures tab and back — the old
 * behaviour reported them as ignored and left the user to go and hand-make each
 * one. Only all-numeric columns qualify; a column of words is a category, and
 * guessing wrong there would silently invent a measure out of prose.
 */
export function proposeMeasures(grid: string[][], measures: Measure[], themes: Theme[]): ProposedMeasure[] {
  if (grid.length < 2 || !looksLikeHeader(grid[0], measures, themes)) return [];
  const headers = grid[0];
  const out: ProposedMeasure[] = [];

  headers.forEach((header, c) => {
    if (header.trim() === '') return;
    if (resolveHeader(header, measures, themes).kind !== 'unmapped') return;

    const cells = grid.slice(1).map(r => (r[c] ?? '').trim()).filter(v => v !== '');
    if (cells.length === 0) return;
    if (!cells.every(v => Number.isFinite(Number(v)))) return;

    const nums = cells.map(Number);
    const extent = safeExtent(nums)!;
    out.push({
      header,
      measure: {
        id: makeId('m'),
        name: header.trim(),
        type: 'directional',
        min: Math.min(1, Math.floor(extent.min)),
        max: Math.max(10, Math.ceil(extent.max)),
        goodEnd: 'high',
        goodDefinition: '',
      },
    });
  });

  return out;
}

function planTablePaste(grid: string[][], ideas: Idea[], measures: Measure[], themes: Theme[], tags: Tag[], newMeasures: Measure[]): PastePlan {
  const headers = grid[0];
  const targets = headers.map(h => resolveHeader(h, measures, themes));
  const body = grid.slice(1).filter(row => row.some(c => c !== ''));

  // A column with no home. Numeric ones are offered as new measures by
  // `proposeMeasures` and are reported there instead, so only the genuinely
  // unusable ones are named here.
  const numericHeaders = new Set(proposeMeasures(grid, measures, themes).map(p => p.header));
  const unmappedColumns = targets
    .filter((t): t is Extract<FieldTarget, { kind: 'unmapped' }> => t.kind === 'unmapped')
    .map(t => t.header)
    .filter(h => h !== '' && !numericHeaders.has(h));

  const nameCol = targets.findIndex(t => t.kind === 'name');
  const idCol = targets.findIndex(t => t.kind === 'id');

  const rejections: Rejection[] = [];
  const updates: IdeaUpdate[] = [];
  const newIdeas: Idea[] = [];
  const newThemes: Theme[] = [];
  const workingTags: Tag[] = [...tags];
  const newTags: Tag[] = [];

  const byId = new Map(ideas.map(i => [i.id.toLowerCase(), i]));
  const byName = new Map(ideas.map(i => [i.name.trim().toLowerCase(), i]));

  body.forEach((row, r) => {
    const rowLabel = `Row ${r + 2}`;
    const idValue = idCol >= 0 ? (row[idCol] ?? '').trim() : '';
    const nameValue = nameCol >= 0 ? (row[nameCol] ?? '').trim() : '';

    let target = idValue ? byId.get(idValue.toLowerCase()) : undefined;
    if (!target && nameValue) target = byName.get(nameValue.toLowerCase());

    const isNew = !target;
    const working: Idea = target
      ? { ...target, values: { ...target.values }, tagsByTheme: { ...target.tagsByTheme } }
      : blankIdea(nameValue || `Untitled ${r + 1}`, measures, themes);

    const changes: CellChange[] = [];

    targets.forEach((t, c) => {
      const raw = (row[c] ?? '').trim();
      if (t.kind === 'unmapped' || t.kind === 'id') return;
      if (raw === '') return;

      switch (t.kind) {
        case 'name':
          if (raw !== working.name) { changes.push({ label: 'Name', from: working.name, to: raw }); working.name = raw; }
          break;
        case 'description':
          if (raw !== working.description) { changes.push({ label: 'Description', from: working.description, to: raw }); working.description = raw; }
          break;
        case 'comments':
          if (raw !== working.comments) { changes.push({ label: 'Comments', from: working.comments, to: raw }); working.comments = raw; }
          break;
        case 'priority': {
          const p = parsePriority(raw);
          if (!p) { rejections.push({ where: `${rowLabel}, Priority`, reason: `"${raw}" is not one of Now, Next, Later, Not planned.` }); break; }
          if (p !== working.priority) { changes.push({ label: 'Priority', from: working.priority, to: p }); working.priority = p; }
          break;
        }
        case 'shortlisted': {
          const on = ['true', 'yes', '1', 'y', 'x', '✓'].includes(raw.toLowerCase());
          if (on !== !!working.shortlisted) { changes.push({ label: 'Shortlisted', from: String(!!working.shortlisted), to: String(on) }); working.shortlisted = on || undefined; }
          break;
        }
        case 'measure': {
          const n = Number(raw);
          if (!Number.isFinite(n)) { rejections.push({ where: `${rowLabel}, ${t.measure.name}`, reason: `"${raw}" is not a number.` }); break; }
          const clamped = clampToRange(n, t.measure.min, t.measure.max);
          if (clamped !== working.values[t.measure.id]) {
            changes.push({ label: t.measure.name, from: String(working.values[t.measure.id] ?? '—'), to: String(clamped) });
            working.values[t.measure.id] = clamped;
          }
          if (clamped !== Math.round(n)) {
            rejections.push({ where: `${rowLabel}, ${t.measure.name}`, reason: `${n} is outside ${t.measure.min}–${t.measure.max}; stored as ${clamped}.` });
          }
          break;
        }
        case 'theme': {
          let tag = workingTags.find(x => x.themeId === t.theme.id && x.label.toLowerCase() === raw.toLowerCase());
          if (!tag) {
            const count = workingTags.filter(x => x.themeId === t.theme.id).length;
            tag = { id: makeId('tag'), themeId: t.theme.id, label: raw, color: TAG_COLORS[count % TAG_COLORS.length] };
            workingTags.push(tag);
            newTags.push(tag);
          }
          if (working.tagsByTheme[t.theme.id] !== tag.id) {
            changes.push({ label: t.theme.name, from: labelOfTag(working.tagsByTheme[t.theme.id], workingTags), to: tag.label });
            working.tagsByTheme[t.theme.id] = tag.id;
          }
          break;
        }
      }
    });

    if (isNew) newIdeas.push(working);
    else if (changes.length > 0) updates.push({ ideaId: working.id, ideaName: working.name, changes });
  });

  return {
    mode: 'table',
    rowCount: body.length,
    columnCount: headers.length,
    newIdeas,
    updates,
    rejections,
    unmappedColumns,
    proposedMeasures: [],
    placeholderNameCount: newIdeas.filter(i => i.name.startsWith('Untitled ')).length,
    newThemes,
    newTags,
    newMeasures,
  };
}

function labelOfTag(tagId: string | null | undefined, tags: Tag[]): string {
  if (!tagId) return '—';
  return tags.find(t => t.id === tagId)?.label ?? '—';
}

function planBlockPaste(
  grid: string[][], ideas: Idea[], measures: Measure[], themes: Theme[],
  anchorRow: number, anchorCol: number, newMeasures: Measure[],
): PastePlan {
  const rejections: Rejection[] = [];
  const updates: IdeaUpdate[] = [];
  const newIdeas: Idea[] = [];

  grid.forEach((row, dr) => {
    const rowIndex = anchorRow + dr;
    const existing = ideas[rowIndex];
    const working: Idea = existing
      ? { ...existing, values: { ...existing.values } }
      : blankIdea(`Untitled ${rowIndex + 1}`, measures, themes);

    const changes: CellChange[] = [];

    row.forEach((raw, dc) => {
      const colIndex = anchorCol + dc;
      const measure = measures[colIndex];
      const cell = raw.trim();
      if (!measure) {
        if (cell !== '') rejections.push({ where: `Column ${colIndex + 1}`, reason: 'Past the last measure column — no measure to put it in.' });
        return;
      }
      if (cell === '') return;
      const n = Number(cell);
      if (!Number.isFinite(n)) {
        rejections.push({ where: `Row ${rowIndex + 1}, ${measure.name}`, reason: `"${cell}" is not a number.` });
        return;
      }
      const clamped = clampToRange(n, measure.min, measure.max);
      if (clamped !== working.values[measure.id]) {
        changes.push({ label: measure.name, from: String(working.values[measure.id] ?? '—'), to: String(clamped) });
        working.values[measure.id] = clamped;
      }
      if (clamped !== Math.round(n)) {
        rejections.push({ where: `Row ${rowIndex + 1}, ${measure.name}`, reason: `${n} is outside ${measure.min}–${measure.max}; stored as ${clamped}.` });
      }
    });

    if (!existing) newIdeas.push(working);
    else if (changes.length > 0) updates.push({ ideaId: working.id, ideaName: working.name, changes });
  });

  return {
    mode: 'block',
    rowCount: grid.length,
    columnCount: grid.reduce((m, r) => Math.max(m, r.length), 0),
    newIdeas,
    updates,
    rejections,
    unmappedColumns: [],
    proposedMeasures: [],
    placeholderNameCount: newIdeas.length,
    newThemes: [],
    newTags: [],
    newMeasures,
  };
}

/** Turn an approved plan into the next ideas array. Pure — callers own the state. */
export function applyPaste(plan: PastePlan, ideas: Idea[], measures: Measure[], themes: Theme[], tags: Tag[]): {
  ideas: Idea[]; tags: Tag[]; themes: Theme[]; measures: Measure[];
} {
  const updateById = new Map<string, Idea>();

  // Re-derive the updated ideas by replaying the recorded changes onto a copy.
  // The plan already carries the resulting values inside `newIdeas`; for updates we
  // rebuild from the change list so the preview and the commit can never disagree.
  const next = ideas.map(idea => {
    const update = plan.updates.find(u => u.ideaId === idea.id);
    if (!update) return idea;
    const copy: Idea = { ...idea, values: { ...idea.values }, tagsByTheme: { ...idea.tagsByTheme } };
    update.changes.forEach(change => {
      const measure = measures.find(m => m.name === change.label);
      if (measure) { copy.values[measure.id] = Number(change.to); return; }
      const theme = themes.find(t => t.name === change.label);
      if (theme) {
        const tag = [...tags, ...plan.newTags].find(x => x.themeId === theme.id && x.label === change.to);
        copy.tagsByTheme[theme.id] = tag?.id ?? null;
        return;
      }
      switch (change.label) {
        case 'Name': copy.name = change.to; break;
        case 'Description': copy.description = change.to; break;
        case 'Comments': copy.comments = change.to; break;
        case 'Priority': copy.priority = change.to as Priority; break;
        case 'Shortlisted': copy.shortlisted = change.to === 'true' || undefined; break;
      }
    });
    updateById.set(copy.id, copy);
    return copy;
  });

  return {
    ideas: [...next, ...plan.newIdeas],
    tags: [...tags, ...plan.newTags],
    themes: [...themes, ...plan.newThemes],
    measures: [...measures, ...plan.newMeasures],
  };
}
