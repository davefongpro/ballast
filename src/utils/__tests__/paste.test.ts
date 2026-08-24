import { describe, it, expect } from 'vitest';
import { parseClipboardGrid, planPaste, applyPaste, proposeMeasures } from '../paste';
import type { Idea, Measure, Theme, Tag } from '../../types';

const measures: Measure[] = [
  { id: 'm-value', name: 'Value', type: 'directional', min: 1, max: 10, goodEnd: 'high' },
  { id: 'm-effort', name: 'Effort', type: 'directional', min: 1, max: 10, goodEnd: 'low' },
];
const themes: Theme[] = [{ id: 'th-1', name: 'Category' }];
const tags: Tag[] = [{ id: 'tag-1', themeId: 'th-1', label: 'Growth', color: '#000' }];

const existing: Idea = {
  id: 'i-1', name: 'Onboarding revamp', description: '', comments: '',
  values: { 'm-value': 5, 'm-effort': 5 }, tagsByTheme: { 'th-1': null }, priority: 'later',
};

const plan = (text: string, opts: Partial<{ ideas: Idea[]; anchorRow: number; anchorCol: number }> = {}) =>
  planPaste({
    grid: parseClipboardGrid(text),
    ideas: opts.ideas ?? [existing],
    measures, themes, tags,
    anchorRow: opts.anchorRow ?? 0,
    anchorCol: opts.anchorCol ?? 0,
  });

describe('clipboard parsing', () => {
  it('reads tab-separated cells', () => {
    expect(parseClipboardGrid('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('falls back to commas and honours quotes', () => {
    expect(parseClipboardGrid('a,"b,c"')).toEqual([['a', 'b,c']]);
  });
  it('ignores trailing newlines', () => {
    expect(parseClipboardGrid('a\tb\n\n')).toEqual([['a', 'b']]);
  });
});

describe('table paste', () => {
  it('matches an existing idea by name and records the change', () => {
    const p = plan('name\tValue\tEffort\nOnboarding revamp\t9\t2');
    expect(p.mode).toBe('table');
    expect(p.newIdeas).toHaveLength(0);
    expect(p.updates[0].changes.map(c => `${c.label} ${c.from}->${c.to}`))
      .toEqual(['Value 5->9', 'Effort 5->2']);
  });

  it('creates ideas for rows that match nothing', () => {
    const p = plan('name\tValue\nUnified search\t8');
    expect(p.newIdeas.map(i => i.name)).toEqual(['Unified search']);
    expect(p.newIdeas[0].values['m-value']).toBe(8);
  });

  it('offers a numeric column with no measure as a measure to create', () => {
    const grid = parseClipboardGrid('name\tValue\tReach\nUnified search\t8\t100');
    const proposals = proposeMeasures(grid, measures, themes);
    expect(proposals.map(p => p.header)).toEqual(['Reach']);
    expect(proposals[0].measure.max).toBe(100);
    // …and does not also scold the user about it as an unusable column
    expect(plan('name\tValue\tReach\nUnified search\t8\t100').unmappedColumns).toEqual([]);
  });

  it('applies an accepted proposal as if the measure already existed', () => {
    const grid = parseClipboardGrid('name\tReach\nUnified search\t42');
    const [proposal] = proposeMeasures(grid, measures, themes);
    const p = planPaste({
      grid, ideas: [existing], measures, themes, tags,
      anchorRow: 0, anchorCol: 0, acceptedMeasures: [proposal.measure],
    });
    expect(p.newMeasures).toHaveLength(1);
    expect(p.newIdeas[0].values[proposal.measure.id]).toBe(42);
  });

  it('reports a non-numeric column with no home rather than dropping it silently', () => {
    const p = plan('name\tValue\tOwner\nUnified search\t8\tPriya');
    expect(p.unmappedColumns).toEqual(['Owner']);
  });

  it('rejects non-numeric measure values with a reason', () => {
    const p = plan('name\tValue\nUnified search\tabc');
    expect(p.rejections[0].reason).toContain('not a number');
  });

  it('clamps out-of-range values and says so', () => {
    const p = plan('name\tValue\nUnified search\t99');
    expect(p.newIdeas[0].values['m-value']).toBe(10);
    expect(p.rejections[0].reason).toContain('stored as 10');
  });

  it('accepts priority synonyms and rejects unknown ones', () => {
    const ok = plan('name\tPriority\nOnboarding revamp\tP0');
    expect(ok.updates[0].changes[0].to).toBe('now');
    const bad = plan('name\tPriority\nOnboarding revamp\tmaybe');
    expect(bad.rejections[0].reason).toContain('not one of');
  });

  it('creates a tag for an unseen theme value', () => {
    const p = plan('name\tCategory\nOnboarding revamp\tRetention');
    expect(p.newTags.map(t => t.label)).toEqual(['Retention']);
  });
});

describe('block paste', () => {
  it('fills right and down from the anchor cell', () => {
    const p = plan('9\t2', { anchorCol: 0 });
    expect(p.mode).toBe('block');
    expect(p.updates[0].changes).toHaveLength(2);
  });

  it('creates rows past the end of the table instead of dropping them', () => {
    const p = plan('9\n8\n7');
    expect(p.newIdeas).toHaveLength(2);
    expect(p.placeholderNameCount).toBe(2);
  });

  it('reports cells past the last measure column', () => {
    const p = plan('9\t2\t4');
    expect(p.rejections.some(r => r.reason.includes('Past the last measure column'))).toBe(true);
  });
});

describe('applying a plan', () => {
  it('produces exactly what the preview described', () => {
    const p = plan('name\tValue\nOnboarding revamp\t9\nUnified search\t3');
    const next = applyPaste(p, [existing], measures, themes, tags);
    expect(next.ideas).toHaveLength(2);
    expect(next.ideas[0].values['m-value']).toBe(9);
    expect(next.ideas[1].name).toBe('Unified search');
  });

  it('never mutates the arrays it was given', () => {
    const p = plan('name\tValue\nOnboarding revamp\t9');
    applyPaste(p, [existing], measures, themes, tags);
    expect(existing.values['m-value']).toBe(5);
  });
});
