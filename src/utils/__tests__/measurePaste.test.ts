import { describe, it, expect } from 'vitest';
import { parseClipboardGrid } from '../paste';
import { planMeasurePaste, applyMeasurePaste } from '../measurePaste';
import type { Measure } from '../../types';

const measures: Measure[] = [
  { id: 'm-value', name: 'Value', type: 'directional', min: 1, max: 10, goodEnd: 'high', protected: true },
];

const plan = (text: string) => planMeasurePaste(parseClipboardGrid(text), measures);

describe('pasting measure definitions', () => {
  it('creates a bipolar measure from pole labels', () => {
    const p = plan('name\tkind\tmin\tmax\tlow pole\thigh pole\nHorizon\tbipolar\t1\t5\tQuick fix\tStructural');
    expect(p.newMeasures).toHaveLength(1);
    expect(p.newMeasures[0]).toMatchObject({ name: 'Horizon', type: 'bipolar', min: 1, max: 5, lowPoleLabel: 'Quick fix', highPoleLabel: 'Structural' });
  });

  it('infers the bipolar kind when only pole labels are given', () => {
    const p = plan('name\tlow pole\thigh pole\nRisk\tLow-risk\tHigh-risk');
    expect(p.newMeasures[0].type).toBe('bipolar');
  });

  it('refuses a bipolar measure with only one end named', () => {
    const p = plan('name\tkind\tlow pole\nRisk\tbipolar\tLow-risk');
    expect(p.newMeasures).toHaveLength(0);
    expect(p.rejections[0].reason).toContain('both ends');
  });

  it('updates an existing measure by name instead of duplicating it', () => {
    const p = plan('name\tbenchmarks\nValue\t1 = nothing · 10 = everything');
    expect(p.newMeasures).toHaveLength(0);
    expect(p.updates[0].changes[0].label).toBe('Benchmarks');
    const next = applyMeasurePaste(p, measures);
    expect(next).toHaveLength(1);
    expect(next[0].benchmarks).toBe('1 = nothing · 10 = everything');
  });

  it('will not change the kind of a built-in measure', () => {
    const p = plan('name\tkind\tlow pole\thigh pole\nValue\tbipolar\tA\tB');
    expect(p.updates).toHaveLength(0);
    expect(p.rejections[0].reason).toContain('built-in');
  });

  it('refuses a range where min is not below max', () => {
    const p = plan('name\tmin\tmax\nScope\t5\t5');
    expect(p.newMeasures).toHaveLength(0);
    expect(p.rejections[0].reason).toContain('not below');
  });

  it('says what is wrong when there is no name column at all', () => {
    const p = plan('kind\tmin\tmax\nbipolar\t1\t5');
    expect(p.fatalError).toContain('No column called "name"');
  });

  it('accepts the words people actually use for the kind', () => {
    expect(plan('name\tkind\nA\ttradeoff').newMeasures).toHaveLength(0); // needs poles
    expect(plan('name\tkind\tlow pole\thigh pole\nA\ttrade-off\tX\tY').newMeasures[0].type).toBe('bipolar');
    expect(plan('name\tkind\nB\tscored').newMeasures[0].type).toBe('directional');
  });

  it('names the columns it ignored', () => {
    const p = plan('name\towner\nScope\tPriya');
    expect(p.unmappedColumns).toEqual(['owner']);
  });
});
