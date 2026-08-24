export type MeasureType = 'directional' | 'bipolar';
export type GoodEnd = 'high' | 'low';
export type Priority = 'now' | 'next' | 'later' | 'not-planned';

export interface Measure {
  id: string;
  name: string;
  type: MeasureType;
  min: number;
  max: number;
  protected?: boolean;
  /**
   * What this measure's numbers actually mean, in the author's own words —
   * e.g. "1 = no measurable effect · 5 = moves a secondary metric · 10 = moves a
   * top-line metric". Written once per measure and readable wherever the measure's
   * name appears, so a score means the same thing to whoever reads it next.
   */
  benchmarks?: string;
  // Directional
  goodEnd?: GoodEnd;
  goodDefinition?: string;
  // Bipolar
  lowPoleLabel?: string;
  highPoleLabel?: string;
}

export interface Theme {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  themeId: string;
  label: string;
  color: string; // hex e.g. "#4E79A7"
}

export interface Idea {
  id: string;
  name: string;
  description: string;
  comments: string;
  values: Record<string, number>; // measureId → integer
  tagsByTheme: Record<string, string | null>; // themeId → tagId | null
  shortlisted?: boolean;
  priority: Priority;
}

export interface ChartConfig {
  xMeasureId: string;
  yMeasureId: string;
  sizeMeasureId?: string;
}
