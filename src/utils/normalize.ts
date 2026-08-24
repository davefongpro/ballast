import type { Measure } from '../types';

/** Rescale a raw value from [min, max] to [0, 100]. */
export function normalize(value: number, min: number, max: number): number {
  if (min === max) return 50; // degenerate: single point, put at midpoint
  if (value === undefined || value === null || isNaN(value)) return 50;
  const clamped = Math.max(min, Math.min(max, value));
  return ((clamped - min) / (max - min)) * 100;
}

/** Get the raw neutral midpoint for a bipolar measure. */
export function rawNeutral(measure: Measure): number {
  return (measure.min + measure.max) / 2;
}

/** Clamp a value to [min, max] and round to integer. */
export function clampToRange(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

/** For a directional measure with goodEnd='low', invert the normalized value. */
export function normalizedForScatter(value: number, measure: Measure): number {
  const n = normalize(value, measure.min, measure.max);
  return measure.type === 'directional' && measure.goodEnd === 'low' ? 100 - n : n;
}
