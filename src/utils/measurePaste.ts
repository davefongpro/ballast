import type { Measure, MeasureType, GoodEnd } from '../types';
import { makeId } from './ids';
import { checkGridSize } from './limits';
import type { CellChange, Rejection } from './paste';

/**
 * Pasting measure definitions in bulk.
 *
 * Defining measures one at a time is the round trip that made pasting ideas
 * feel like half a feature: a spreadsheet column with no matching measure could
 * not be used until someone went and hand-made the measure first. This reads a
 * block of measure definitions the same way the Data tab reads a block of ideas
 * — matched by header name, previewed before anything is applied.
 */

export interface MeasurePastePlan {
  newMeasures: Measure[];
  updates: { id: string; name: string; changes: CellChange[] }[];
  rejections: Rejection[];
  unmappedColumns: string[];
  fatalError?: string;
}

type Field = 'name' | 'type' | 'min' | 'max' | 'better' | 'lowPole' | 'highPole' | 'benchmarks' | null;

const HEADERS: Record<string, Field> = {
  'name': 'name', 'measure': 'name', 'title': 'name',
  'kind': 'type', 'type': 'type',
  'min': 'min', 'minimum': 'min', 'from': 'min',
  'max': 'max', 'maximum': 'max', 'to': 'max',
  'better': 'better', 'good': 'better', 'good end': 'better', 'better end': 'better', 'direction': 'better',
  'low pole': 'lowPole', 'low label': 'lowPole', 'low': 'lowPole', 'left': 'lowPole', 'low end': 'lowPole',
  'high pole': 'highPole', 'high label': 'highPole', 'high': 'highPole', 'right': 'highPole', 'high end': 'highPole',
  'benchmarks': 'benchmarks', 'benchmark': 'benchmarks', 'scale': 'benchmarks',
  'meaning': 'benchmarks', 'notes': 'benchmarks', 'definition': 'benchmarks',
};

function resolve(header: string): Field {
  return HEADERS[header.trim().toLowerCase()] ?? null;
}

function parseType(raw: string): MeasureType | null {
  const v = raw.trim().toLowerCase();
  if (['bipolar', 'two-ended', 'tradeoff', 'trade-off', 'poles', 'no winner'].includes(v)) return 'bipolar';
  if (['directional', 'scored', 'one-way', 'scale', 'ranked'].includes(v)) return 'directional';
  return null;
}

function parseBetter(raw: string): GoodEnd | null {
  const v = raw.trim().toLowerCase();
  if (['high', 'higher', 'up', 'more', 'max'].includes(v)) return 'high';
  if (['low', 'lower', 'down', 'less', 'min'].includes(v)) return 'low';
  return null;
}

export function planMeasurePaste(grid: string[][], measures: Measure[]): MeasurePastePlan {
  const empty: MeasurePastePlan = { newMeasures: [], updates: [], rejections: [], unmappedColumns: [] };
  if (grid.length === 0) return { ...empty, fatalError: 'The clipboard was empty.' };

  const widest = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const sizeError = checkGridSize(grid.length, widest);
  if (sizeError) return { ...empty, fatalError: sizeError };

  const headers = grid[0].map(resolve);
  if (!headers.includes('name')) {
    return {
      ...empty,
      fatalError: 'No column called "name". Paste a header row naming the columns — at minimum a Name column, plus Kind, Min, Max and either Better or the two pole labels.',
    };
  }

  const unmappedColumns = grid[0].filter((h, i) => h.trim() !== '' && headers[i] === null);
  const body = grid.slice(1).filter(row => row.some(c => c.trim() !== ''));

  const rejections: Rejection[] = [];
  const newMeasures: Measure[] = [];
  const updates: MeasurePastePlan['updates'] = [];
  const byName = new Map(measures.map(m => [m.name.trim().toLowerCase(), m]));

  body.forEach((row, r) => {
    const rowLabel = `Row ${r + 2}`;
    const cell = (f: Field) => {
      const i = headers.indexOf(f);
      return i < 0 ? '' : (row[i] ?? '').trim();
    };

    const name = cell('name');
    if (!name) { rejections.push({ where: rowLabel, reason: 'No measure name — row skipped.' }); return; }

    const existing = byName.get(name.toLowerCase());
    const draft: Measure = existing
      ? { ...existing }
      : { id: makeId('m'), name, type: 'directional', min: 1, max: 10, goodEnd: 'high', goodDefinition: '' };

    const changes: CellChange[] = [];
    const set = <K extends keyof Measure>(key: K, label: string, value: Measure[K]) => {
      if (draft[key] === value) return;
      changes.push({ label, from: String(draft[key] ?? '—'), to: String(value ?? '—') });
      draft[key] = value;
    };

    const typeRaw = cell('type');
    if (typeRaw) {
      const parsed = parseType(typeRaw);
      if (parsed) set('type', 'Kind', parsed);
      else rejections.push({ where: `${rowLabel}, Kind`, reason: `"${typeRaw}" is not "directional" or "bipolar".` });
    } else if (!existing && (cell('lowPole') || cell('highPole'))) {
      // Pole labels with no stated kind can only mean a bipolar measure.
      set('type', 'Kind', 'bipolar');
    }

    (['min', 'max'] as const).forEach(f => {
      const raw = cell(f);
      if (!raw) return;
      const n = Number(raw);
      if (!Number.isFinite(n)) { rejections.push({ where: `${rowLabel}, ${f}`, reason: `"${raw}" is not a number.` }); return; }
      set(f, f === 'min' ? 'Min' : 'Max', Math.round(n));
    });

    if (draft.min >= draft.max) {
      rejections.push({ where: rowLabel, reason: `Min ${draft.min} is not below max ${draft.max} — row skipped.` });
      return;
    }

    const betterRaw = cell('better');
    if (betterRaw) {
      const parsed = parseBetter(betterRaw);
      if (parsed) set('goodEnd', 'Better end', parsed);
      else rejections.push({ where: `${rowLabel}, Better`, reason: `"${betterRaw}" is not "high" or "low".` });
    }

    const low = cell('lowPole');
    const high = cell('highPole');
    if (low) set('lowPoleLabel', 'Low pole', low);
    if (high) set('highPoleLabel', 'High pole', high);

    const benchmarks = cell('benchmarks');
    if (benchmarks) set('benchmarks', 'Benchmarks', benchmarks);

    if (draft.type === 'bipolar' && (!draft.lowPoleLabel || !draft.highPoleLabel)) {
      rejections.push({
        where: rowLabel,
        reason: 'A bipolar measure needs a name for both ends. Add "Low pole" and "High pole" columns — row skipped.',
      });
      return;
    }

    if (existing) {
      if (existing.protected && draft.type !== existing.type) {
        rejections.push({ where: rowLabel, reason: `"${existing.name}" is a built-in measure and its kind cannot be changed.` });
        return;
      }
      if (changes.length > 0) updates.push({ id: draft.id, name: draft.name, changes });
    } else {
      newMeasures.push(draft);
      byName.set(name.toLowerCase(), draft);
    }
  });

  return { newMeasures, updates, rejections, unmappedColumns };
}

/** Apply an approved measure plan. Pure — the caller owns the state. */
export function applyMeasurePaste(plan: MeasurePastePlan, measures: Measure[]): Measure[] {
  const updated = measures.map(m => {
    const update = plan.updates.find(u => u.id === m.id);
    if (!update) return m;
    const next: Measure = { ...m };
    update.changes.forEach(c => {
      switch (c.label) {
        case 'Kind': next.type = c.to as MeasureType; break;
        case 'Min': next.min = Number(c.to); break;
        case 'Max': next.max = Number(c.to); break;
        case 'Better end': next.goodEnd = c.to as GoodEnd; break;
        case 'Low pole': next.lowPoleLabel = c.to; break;
        case 'High pole': next.highPoleLabel = c.to; break;
        case 'Benchmarks': next.benchmarks = c.to; break;
      }
    });
    return next;
  });
  return [...updated, ...plan.newMeasures];
}

/** A blank measures CSV in exactly the shape this parser expects. */
export function measureTemplateCSV(): string {
  return [
    'name,kind,min,max,better,low pole,high pole,benchmarks',
    'Value,directional,1,10,high,,,1 = no measurable effect · 5 = moves a secondary metric · 10 = moves a top-line metric',
    'Horizon,bipolar,1,5,,Quick fix,Structural,1 = relieves the symptom now · 5 = removes the cause for good',
  ].join('\n');
}
