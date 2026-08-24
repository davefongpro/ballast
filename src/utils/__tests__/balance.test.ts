import { describe, it, expect } from 'vitest';
import { computeBalance } from '../balance';
import { safeExtent, checkGridSize } from '../limits';
import type { Idea, Measure } from '../../types';

const visibility: Measure = {
  id: 'm-vis', name: 'Visibility', type: 'bipolar', min: 1, max: 10,
  lowPoleLabel: 'Internal', highPoleLabel: 'Customer-facing',
};
const value: Measure = { id: 'm-val', name: 'Value', type: 'directional', min: 1, max: 10, goodEnd: 'high' };

const ideas = (vals: number[]): Idea[] => vals.map((v, i) => ({
  id: `i${i}`, name: `Idea ${i}`, description: '', comments: '',
  values: { 'm-vis': v }, tagsByTheme: {}, priority: 'now',
}));

describe('portfolio balance', () => {
  it('ignores directional measures — a lean is only meaningful with two poles', () => {
    expect(computeBalance(ideas([1, 9]), [value]).measures).toHaveLength(0);
  });

  it('names a lean when nearly everything takes the same side', () => {
    const report = computeBalance(ideas([1, 2, 2, 1, 3, 9]), [visibility]);
    expect(report.headline?.lean).toBe('low');
    expect(report.headline?.sentence).toContain('leans Internal');
  });

  it('does not call a genuine split a lean', () => {
    const report = computeBalance(ideas([1, 2, 9, 10]), [visibility]);
    expect(report.headline).toBeNull();
    expect(report.measures[0].sentence).toContain('genuinely split');
  });

  it('reads an all-neutral set as flat, not as a lean', () => {
    const report = computeBalance(ideas([5, 6, 5, 6]), [visibility]);
    expect(report.measures[0].lean).toBe('centred');
    expect(report.measures[0].sentence).toContain('flat');
  });

  it('never reports a side that has no ideas as "spread across both ends"', () => {
    const sentence = computeBalance(ideas([1, 1, 2, 2]), [visibility]).measures[0].sentence;
    expect(sentence).toContain('nothing at the Customer-facing end');
  });

  it('skips ideas with no value for the measure rather than counting them as neutral', () => {
    const withGap = ideas([1, 1]);
    withGap.push({ id: 'x', name: 'x', description: '', comments: '', values: {}, tagsByTheme: {}, priority: 'now' });
    expect(computeBalance(withGap, [visibility]).measures[0].lowCount).toBe(2);
  });
});

describe('input bounds', () => {
  it('finds an extent without an argument spread', () => {
    const big = Array.from({ length: 200_000 }, (_, i) => i);
    expect(safeExtent(big)).toEqual({ min: 0, max: 199_999 });
    expect(safeExtent([])).toBeNull();
  });

  it('rejects oversized grids with a stated reason', () => {
    expect(checkGridSize(10, 10)).toBeNull();
    expect(checkGridSize(9_999_999, 10)).toContain('limit');
    expect(checkGridSize(10, 9_999)).toContain('limit');
  });
});
