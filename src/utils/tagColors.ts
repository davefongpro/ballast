/**
 * The categorical palette, mirrored from `--cat-1..8` in `src/styles/tokens.css`.
 *
 * Chart libraries and raw SVG cannot read a CSS variable, so these eight values
 * exist twice by necessity. This is the only sanctioned duplication in the system:
 * change one, change the other. Every value clears 5.6:1 against the app ground.
 */
export const TAG_COLORS = [
  '#6FA8FF', '#F2A65A', '#59C08D', '#D07CC7',
  '#E0685F', '#59BFD0', '#BFAE5C', '#8E92E8',
];

/** Chart furniture, likewise mirrored from tokens.css. */
export const CHART = {
  grid: '#212730',
  axis: '#39414E',
  neutral: '#4A5462',
  text: '#A8B0BC',
  textFaint: '#858D9A',
  surface: '#171B21',
  border: '#39414E',
  accent: '#E5A64B',
} as const;
