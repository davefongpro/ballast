import { useEffect, useState } from 'react';
import type { Idea, Measure, Theme, Tag, Priority } from '../types';
import { SpiderChart } from './charts/SpiderChart';
import { clampToRange } from '../utils/normalize';
import { MeasureTip } from './MeasureTip';
import { Button, Modal } from './ui';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'now', label: 'Now', color: 'var(--c-now)' },
  { value: 'next', label: 'Next', color: 'var(--c-next)' },
  { value: 'later', label: 'Later', color: 'var(--c-later)' },
  { value: 'not-planned', label: 'Not planned', color: 'var(--c-not-planned)' },
];

interface Props {
  idea: Idea | null;
  measures: Measure[];
  themes: Theme[];
  tags: Tag[];
  drillMeasureIds: string[];
  /** What this value was at the last load, import or reset. */
  baselineValue: (ideaId: string, measureId: string) => number | undefined;
  baselineLabel: string;
  onClose: () => void;
  onUpdateIdea: (idea: Idea, label?: string) => void;
  onPriorityChange?: (idea: Idea, priority: Priority) => void;
}

function MeasureField({
  measure, value, was, baselineLabel, onUpdate,
}: {
  measure: Measure;
  value: number;
  was?: number;
  baselineLabel: string;
  onUpdate: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => { if (!focused) setDraft(String(value)); }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const n = parseInt(draft, 10);
    const clamped = clampToRange(Number.isNaN(n) ? measure.min : n, measure.min, measure.max);
    setDraft(String(clamped));
    onUpdate(clamped);
  };

  return (
    <div className="field">
      <span className="field__label"><MeasureTip measure={measure} /></span>
      <input
        className="input"
        type="number"
        value={draft}
        min={measure.min}
        max={measure.max}
        onFocus={() => setFocused(true)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label={measure.name}
      />
      {was !== undefined && was !== value && (
        <span className="field__hint">was {was} on {baselineLabel}</span>
      )}
    </div>
  );
}

export function DrillDown({
  idea, measures, themes, tags, drillMeasureIds, baselineValue, baselineLabel,
  onClose, onUpdateIdea, onPriorityChange,
}: Props) {
  if (!idea) return null;

  const update = (next: Idea, label?: string) => onUpdateIdea(next, label);
  const shown = measures.filter(m => drillMeasureIds.includes(m.id));
  const bipolar = shown.filter(m => m.type === 'bipolar');
  const directional = shown.filter(m => m.type === 'directional');
  const changedCount = measures.filter(m => {
    const was = baselineValue(idea.id, m.id);
    return was !== undefined && was !== idea.values[m.id];
  }).length;

  return (
    <Modal title={idea.name} width={640} onClose={onClose} centreTitle>
      <div className="stack" style={{ gap: 'var(--s-5)' }}>
        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            size="sm"
            variant={idea.shortlisted ? 'primary' : 'default'}
            onClick={() => update({ ...idea, shortlisted: !idea.shortlisted }, 'shortlist')}
          >
            {idea.shortlisted ? '★ Shortlisted' : '☆ Shortlist'}
          </Button>
          {PRIORITY_OPTIONS.map(opt => {
            const active = (idea.priority ?? 'not-planned') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() => onPriorityChange
                  ? onPriorityChange(idea, opt.value)
                  : update({ ...idea, priority: opt.value }, 'set priority')}
              >
                <span className="chip__dot" style={{ background: opt.color }} />
                {opt.label}
              </button>
            );
          })}
        </div>

        {shown.length >= 3 && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <SpiderChart
              idea={idea}
              measures={shown}
              size={280}
              color="var(--c-accent)"
              draggable
              onValueChange={(measureId, v) => update(
                { ...idea, values: { ...idea.values, [measureId]: v } },
                `drag ${idea.name}`,
              )}
            />
          </div>
        )}

        {changedCount > 0 && (
          <p className="subtle" style={{ margin: 0 }}>
            {changedCount} {changedCount === 1 ? 'value has' : 'values have'} changed since {baselineLabel}. The old
            number sits under each one.
          </p>
        )}

        {bipolar.length > 0 && (
          <section className="stack" style={{ gap: 'var(--s-3)' }}>
            <h4 className="eyebrow">Tradeoffs</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--s-3)' }}>
              {bipolar.map(m => (
                <MeasureField
                  key={m.id}
                  measure={m}
                  value={idea.values[m.id] ?? m.min}
                  was={baselineValue(idea.id, m.id)}
                  baselineLabel={baselineLabel}
                  onUpdate={v => update({ ...idea, values: { ...idea.values, [m.id]: v } }, `edit ${m.name}`)}
                />
              ))}
            </div>
          </section>
        )}

        {directional.length > 0 && (
          <section className="stack" style={{ gap: 'var(--s-3)' }}>
            <h4 className="eyebrow">Scores</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--s-3)' }}>
              {directional.map(m => (
                <MeasureField
                  key={m.id}
                  measure={m}
                  value={idea.values[m.id] ?? m.min}
                  was={baselineValue(idea.id, m.id)}
                  baselineLabel={baselineLabel}
                  onUpdate={v => update({ ...idea, values: { ...idea.values, [m.id]: v } }, `edit ${m.name}`)}
                />
              ))}
            </div>
          </section>
        )}

        <div className="field">
          <label className="field__label" htmlFor="dd-desc">Description</label>
          <textarea
            id="dd-desc"
            className="textarea"
            style={{ minHeight: 70, fontFamily: 'var(--font-sans)', fontSize: 'var(--t-base)' }}
            value={idea.description}
            onChange={e => update({ ...idea, description: e.target.value }, 'edit description')}
            placeholder="What is it?"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="dd-comments">Comments — why these numbers</label>
          <textarea
            id="dd-comments"
            className="textarea"
            style={{ minHeight: 90, fontFamily: 'var(--font-sans)', fontSize: 'var(--t-base)' }}
            value={idea.comments}
            onChange={e => update({ ...idea, comments: e.target.value }, 'edit comment')}
            placeholder="Where the estimates came from, who disagreed, what would change them."
          />
          <span className="field__hint">
            The place to record your reasoning, so the scores can be argued with rather than just believed.
          </span>
        </div>

        {themes.length > 0 && (
          <section className="stack" style={{ gap: 'var(--s-3)' }}>
            <h4 className="eyebrow">Categories</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--s-3)' }}>
              {themes.map(theme => (
                <div className="field" key={theme.id}>
                  <label className="field__label" htmlFor={`dd-${theme.id}`}>{theme.name}</label>
                  <select
                    id={`dd-${theme.id}`}
                    className="select"
                    value={idea.tagsByTheme?.[theme.id] ?? ''}
                    onChange={e => update(
                      { ...idea, tagsByTheme: { ...(idea.tagsByTheme ?? {}), [theme.id]: e.target.value || null } },
                      `set ${theme.name}`,
                    )}
                  >
                    <option value="">—</option>
                    {tags.filter(t => t.themeId === theme.id).map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
