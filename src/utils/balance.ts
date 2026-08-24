import type { Idea, Measure } from '../types';

/**
 * The portfolio balance readout.
 *
 * Bipolar measures — axes with two named ends and no better one — are what this
 * tool exists for, and their value is a statement about the whole set rather than
 * about any one idea: *every item you have committed to sits on the quick-fix
 * pole*. Reading that off a stack of radar charts by eye is exactly what people do
 * not do, so it is computed and written out in words here.
 *
 * The thresholds are deliberately blunt. This reports a lean; it does not score.
 */

export type Lean = 'low' | 'high' | 'balanced' | 'centred';

export interface MeasureBalance {
  measure: Measure;
  lean: Lean;
  /** Share of ideas sitting on the leaning pole, 0-1. */
  share: number;
  lowLabel: string;
  highLabel: string;
  lowCount: number;
  highCount: number;
  neutralCount: number;
  /** One sentence, ready to render. */
  sentence: string;
}

export interface BalanceReport {
  ideaCount: number;
  measures: MeasureBalance[];
  /** The single strongest lean, or null when nothing leans. */
  headline: MeasureBalance | null;
}

const LEAN_THRESHOLD = 0.7;

export function computeBalance(ideas: Idea[], measures: Measure[]): BalanceReport {
  const bipolar = measures.filter(m => m.type === 'bipolar');
  const results: MeasureBalance[] = [];

  bipolar.forEach(measure => {
    const midpoint = (measure.min + measure.max) / 2;
    const band = (measure.max - measure.min) * 0.1;

    let low = 0, high = 0, neutral = 0, counted = 0;
    ideas.forEach(idea => {
      const v = idea.values[measure.id];
      if (typeof v !== 'number' || Number.isNaN(v)) return;
      counted++;
      if (Math.abs(v - midpoint) <= band) neutral++;
      else if (v < midpoint) low++;
      else high++;
    });

    if (counted === 0) return;

    const lowLabel = measure.lowPoleLabel?.trim() || `low ${measure.name}`;
    const highLabel = measure.highPoleLabel?.trim() || `high ${measure.name}`;

    // The lean is judged among the ideas that actually take a side. Counting the
    // neutral ones against it would report "spread across both ends: 16 Internal,
    // 0 Customer-facing" — which is the opposite of what that data says.
    const committed = low + high;
    const lowShare = committed === 0 ? 0 : low / committed;
    const highShare = committed === 0 ? 0 : high / committed;

    let lean: Lean = 'balanced';
    let share = Math.max(lowShare, highShare);
    if (committed === 0 || neutral / counted >= LEAN_THRESHOLD) { lean = 'centred'; share = neutral / counted; }
    else if (lowShare >= LEAN_THRESHOLD) lean = 'low';
    else if (highShare >= LEAN_THRESHOLD) lean = 'high';

    const sentence =
      lean === 'low'
        ? `${measure.name} leans ${lowLabel}: ${low} of the ${committed} that take a side, ${high === 0 ? `with nothing at the ${highLabel} end` : `against ${high} ${highLabel}`}.`
      : lean === 'high'
        ? `${measure.name} leans ${highLabel}: ${high} of the ${committed} that take a side, ${low === 0 ? `with nothing at the ${lowLabel} end` : `against ${low} ${lowLabel}`}.`
      : lean === 'centred'
        ? `${measure.name} is flat — ${neutral} of ${counted} sit near the middle, committing to neither ${lowLabel} nor ${highLabel}.`
      : `${measure.name} is genuinely split: ${low} ${lowLabel}, ${high} ${highLabel}${neutral > 0 ? `, ${neutral} in the middle` : ''}.`;

    results.push({ measure, lean, share, lowLabel, highLabel, lowCount: low, highCount: high, neutralCount: neutral, sentence });
  });

  const leaning = results.filter(r => r.lean === 'low' || r.lean === 'high' || r.lean === 'centred');
  leaning.sort((a, b) => b.share - a.share);

  return { ideaCount: ideas.length, measures: results, headline: leaning[0] ?? null };
}
