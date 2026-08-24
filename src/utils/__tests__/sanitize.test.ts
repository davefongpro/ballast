import { describe, it, expect } from 'vitest';
import { sanitizeCell, unsanitizeCell } from '../sanitize';
import { exportCSV } from '../csvUtils';
import { exportMarkdown } from '../markdownUtils';
import type { Idea, Measure } from '../../types';

const measure: Measure = { id: 'm1', name: 'Value', type: 'directional', min: 1, max: 10, goodEnd: 'high' };
const idea = (name: string): Idea => ({
  id: 'i1', name, description: '', comments: '', values: { m1: 5 }, tagsByTheme: {}, priority: 'now',
});

describe('formula-injection neutralisation', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tlead', '\rlead'])('neutralises %j', input => {
    expect(sanitizeCell(input).startsWith("'")).toBe(true);
  });

  it('leaves ordinary text alone', () => {
    expect(sanitizeCell('Onboarding revamp')).toBe('Onboarding revamp');
    expect(sanitizeCell('')).toBe('');
    expect(sanitizeCell(undefined)).toBe('');
  });

  it('round-trips', () => {
    expect(unsanitizeCell(sanitizeCell('=cmd'))).toBe('=cmd');
    expect(unsanitizeCell("'quoted phrase")).toBe("'quoted phrase");
  });

  it('neutralises through the CSV export path', () => {
    const csv = exportCSV([idea('=cmd|\' /C calc\'!A0')], [measure], [], []);
    expect(csv).toContain("'=cmd");
    expect(csv.split('\n')[1].startsWith('=')).toBe(false);
  });

  it('neutralises through the Markdown export path but keeps the table separator', () => {
    const md = exportMarkdown([idea('=danger')], [measure]);
    const lines = md.split('\n');
    expect(lines[1]).toBe('| --- | --- | --- | --- |');
    expect(lines[2]).toContain("'=danger");
  });
});
