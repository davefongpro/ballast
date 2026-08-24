import type { Measure } from '../types';

/**
 * Axis labels for the radar charts, shared by SpiderChart and DensityOverlay so
 * the two cannot drift apart. Kept apart from the component so the file exports
 * only functions and the component file exports only a component.
 *
 * The labels sit outside the outermost ring, and the side ones run horizontally
 * away from it — so a chart's real width is the ring plus a label's worth of
 * space on each side. Nothing accounted for that: both charts sized their SVG to
 * the ring alone and set `overflow: visible`, which let every label spill into
 * whatever sat next to it. Four charts in a row collided on any screen under
 * about 1700px wide.
 */

export const NAME_SIZE = 9;
export const POLE_SIZE = 8;
/** Rough advance width per character for the interface face, by font size. */
export const NAME_CHAR = 4.9;
export const POLE_CHAR = 4.4;

/**
 * Below this the pole labels ("Individual ↔ Team-wide") are dropped and only the
 * measure name is drawn. At 8px inside a 160px chart they were unreadable anyway,
 * and they are what made the labels wide enough to collide. The full pair still
 * shows on the large overlay and in the drill-down.
 */
export const POLE_LABEL_MIN_SIZE = 220;

export const poleText = (m: Measure) => `${m.lowPoleLabel} ↔ ${m.highPoleLabel}`;
export const nameText = (m: Measure) =>
  m.type === 'bipolar' ? m.name : `${m.name}${m.goodEnd === 'high' ? ' ↑' : ' ↓'}`;

export function truncate(text: string, maxChars: number) {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

/**
 * Horizontal room one side needs for its labels. Capped, because a measure may be
 * named anything and an uncapped pad would let one long name push the chart out of
 * its column — the same failure in a new place. Past the cap the text is truncated.
 */
export function labelPad(size: number, measures: Measure[]): number {
  const cap = size * 0.75;
  const showPoles = size >= POLE_LABEL_MIN_SIZE;
  const widest = measures.reduce((max, m) => {
    const name = nameText(m).length * NAME_CHAR;
    const pole = showPoles && m.type === 'bipolar' ? poleText(m).length * POLE_CHAR : 0;
    return Math.max(max, name, pole);
  }, 0);
  return Math.ceil(Math.min(widest, cap)) + 6;
}

