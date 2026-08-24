import { useState } from 'react';
import type { Idea, Measure, Theme, Tag, Priority } from '../../types';
import { FilterBar } from '../FilterBar';
import { Button, Collapsible, Modal } from '../ui';
import { BalanceReadout } from '../BalanceReadout';
import { SpiderChart } from '../charts/SpiderChart';
import { AxisLabels } from '../charts/AxisLabels';
import { labelPad } from '../../utils/axisLabels';
import { normalizedForScatter } from '../../utils/normalize';

interface Props {
  ideas: Idea[];
  measures: Measure[];
  themes: Theme[];
  tags: Tag[];
  selectedMeasureIds: string[];
  onSelectMeasure: (id: string, checked: boolean) => void;
  onDrill: (idea: Idea, excludeIds: string[]) => void;
  onUpdateIdea: (idea: Idea) => void;
  shortlistFilter: boolean;
  onShortlistFilterChange: (v: boolean) => void;
  colorByThemeId: string | null;
  onColorByChange: (id: string | null) => void;
  priorityFilter: Priority[];
  onPriorityFilterToggle: (p: Priority) => void;
  getIdeaColor: (idea: Idea, tags: Tag[]) => string | undefined;
}

// B-2: SVG blur filter + higher opacity for density contrast
function DensityOverlay({ ideas, measures, size }: { ideas: Idea[]; measures: Measure[]; size: number }) {
  const pad = labelPad(size, measures);
  const width = size + pad * 2;
  const cx = size / 2 + pad;
  const cy = size / 2;
  const r = size * 0.32;
  const n = measures.length;

  if (n < 3 || ideas.length === 0) return null;

  const angle = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;
  const point = (i: number, frac: number) => ({
    x: cx + r * frac * Math.cos(angle(i)),
    y: cy + r * frac * Math.sin(angle(i)),
  });

  const LEVELS = 4;
  const gridPolygon = (frac: number) =>
    Array.from({ length: n }, (_, i) => point(i, frac)).map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={width} height={size} style={{ overflow: 'visible' }}>
      <defs>
        {/*
          Heat color filter: blurs all idea polygons together, then maps
          accumulated alpha to a yellow→orange→red heat scale.
          R'=1 always, G'=1-2α (yellow when sparse, 0 when dense), A' amplified.
        */}
        <filter id="density-heat" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blurred" />
          <feColorMatrix type="matrix" in="blurred" values="
            0 0 0 0 1
            0 0 0 -1.5 1
            0 0 0 0 0
            0 0 0 8 -0.4
          " />
        </filter>
      </defs>

      {Array.from({ length: LEVELS }, (_, lvl) => {
        const frac = (lvl + 1) / LEVELS;
        return <polygon key={lvl} points={gridPolygon(frac)} fill="none" stroke={frac === 1 ? 'var(--c-axis)' : 'var(--c-border)'} strokeWidth={frac === 1 ? 1.5 : 1} />;
      })}
      <polygon points={gridPolygon(0.5)} fill="none" stroke="var(--c-neutral-line)" strokeWidth={1} strokeDasharray="3 3" />
      {measures.map((_, i) => {
        const tip = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="var(--c-grid)" strokeWidth={1} />;
      })}

      {/* Heat density layer: white polygons blurred then color-mapped to yellow→red */}
      <g filter="url(#density-heat)">
        {ideas.map(idea => {
          const fracs = measures.map(m => normalizedForScatter(idea.values[m.id] ?? m.min, m) / 100);
          const polygon = fracs.map((frac, i) => point(i, frac)).map(p => `${p.x},${p.y}`).join(' ');
          return (
            <polygon key={idea.id} points={polygon} fill="white" fillOpacity={0.07} stroke="white" strokeOpacity={0.07} strokeWidth={1.5} />
          );
        })}
      </g>

      {/* Axis labels (outside blur) */}
      <AxisLabels cx={cx} cy={cy} r={r} size={size} measures={measures} />

    </svg>
  );
}


const PRIORITY_CHIPS: { value: Priority; label: string; color: string }[] = [
  { value: 'now',         label: 'Now',         color: 'var(--c-now)' },
  { value: 'next',        label: 'Next',        color: 'var(--c-next)' },
  { value: 'later',       label: 'Later',       color: 'var(--c-later)' },
  { value: 'not-planned', label: 'Not Planned', color: 'var(--c-not-planned)' },
];

export function ProfilesTab({ ideas, measures, themes, tags, selectedMeasureIds, onSelectMeasure, onDrill, onUpdateIdea, shortlistFilter, onShortlistFilterChange, colorByThemeId, onColorByChange, priorityFilter, onPriorityFilterToggle, getIdeaColor }: Props) {
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  // The written reading of the density overlay — the same picture, said in words.
  const [abstractOpen, setAbstractOpen] = useState(false);

  const selectedMeasures = selectedMeasureIds
    .map(id => measures.find(m => m.id === id))
    .filter(Boolean) as Measure[];

  const tooFew = selectedMeasureIds.length < 2;
  const readabilityHint = selectedMeasureIds.length > 10;

  const activeFilters = Object.entries(filterState).filter(([, v]) => v !== '');
  const filteredIdeas = ideas
    .filter(idea => !shortlistFilter || idea.shortlisted)
    .filter(idea => activeFilters.every(([themeId, tagId]) => idea.tagsByTheme?.[themeId] === tagId))
    .filter(idea => priorityFilter.length === 0 || priorityFilter.includes(idea.priority ?? 'not-planned'));

  const hasShortlisted = ideas.some(i => i.shortlisted);

  if (ideas.length === 0 || measures.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-text-3)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🕸️</div>
        <p>Add ideas and measures in the Data and Measures tabs to see spider profiles here.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Collapsible summary="Filters and axes">
      <FilterBar
        themes={themes}
        tags={tags}
        filterState={filterState}
        onFilterChange={setFilterState}
        colorByThemeId={colorByThemeId}
        onColorByChange={onColorByChange}
        priorityFilter={priorityFilter}
        onPriorityFilterToggle={onPriorityFilterToggle}
        hasShortlisted={hasShortlisted}
        shortlistFilter={shortlistFilter}
        onShortlistFilterChange={onShortlistFilterChange}
      />

      <details className="card" open={false}>
        <summary style={{ padding: 'var(--s-4)', cursor: 'pointer', fontWeight: 600, listStyle: 'none' }}>
          Axes on the profiles — {selectedMeasureIds.length} of {measures.length} chosen
          {tooFew && <span style={{ color: 'var(--c-warn)' }}> · choose at least 2</span>}
          {readabilityHint && <span className="subtle" style={{ fontWeight: 400 }}> · more than 10 gets hard to read</span>}
        </summary>
        <div className="card__body" style={{ borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--s-3)' }}>
          {measures.map(m => (
            <label key={m.id} className="row" style={{ gap: 'var(--s-2)', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedMeasureIds.includes(m.id)}
                onChange={e => onSelectMeasure(m.id, e.target.checked)}
                style={{ marginTop: 3, accentColor: 'var(--c-accent)' }}
              />
              <span>
                <span style={{ display: 'block', fontWeight: 600, color: 'var(--c-text)' }}>{m.name}</span>
                <span className="subtle mono" style={{ fontSize: 'var(--t-2xs)' }}>
                  {m.type === 'directional'
                    ? `${m.min}–${m.max}, ${m.goodEnd === 'low' ? 'lower' : 'higher'} is better`
                    : `${m.lowPoleLabel} ←→ ${m.highPoleLabel}`}
                </span>
              </span>
            </label>
          ))}
        </div>
      </details>
      </Collapsible>


        {tooFew ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-3)' }}>
            Choose at least 2 axes above to draw the profiles.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--c-text-3)', marginBottom: 16 }}>
              {filteredIdeas.length} idea{filteredIdeas.length !== 1 ? 's' : ''} on {selectedMeasures.length} axes.
              Values normalized to a shared 0–100 ring. Dashed ring = neutral midpoint (50).
              Drag any vertex to update that measure's value.
            </div>

            {/* Density overlay — full width */}
            <div className="card" style={{ padding: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--s-3)', marginBottom: 'var(--s-3)', flexWrap: 'wrap' }}>
                <span className="eyebrow">All ideas — density overlay</span>
                <Button size="sm" onClick={() => setAbstractOpen(true)}>Read the abstract</Button>
              </div>
              {filteredIdeas.length === 0 || selectedMeasures.length < 2 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13 }}>
                  {filteredIdeas.length === 0
                    ? shortlistFilter
                      ? 'No shortlisted ideas. Star ideas in the Data tab.'
                      : 'No ideas match the current filter.'
                    : 'Select 2+ measures to see the overlay.'}
                </div>
              ) : (
                <button
                  type="button"
                  className="overlay-open"
                  onClick={() => setAbstractOpen(true)}
                  title="Read this shape in words"
                >
                  <DensityOverlay ideas={filteredIdeas} measures={selectedMeasures} size={280} />
                  <span className="overlay-open__hint">Read this in words</span>
                </button>
              )}
            </div>

            {/* By Priority density panels — 1×4 grid */}
            <div className="card" style={{ padding: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                By Priority
              </div>
              {/* Wraps rather than crushing: four fixed columns forced the charts
                  narrower than their labels on anything under a wide desktop. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {PRIORITY_CHIPS.map(chip => {
                  const priorityIdeas = filteredIdeas.filter(i => (i.priority ?? 'not-planned') === chip.value);
                  return (
                    <div key={chip.value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: chip.color,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '2px 10px', borderRadius: 20,
                        background: chip.color + '15', border: `1px solid ${chip.color}40`,
                      }}>
                        {chip.label}
                      </div>
                      {priorityIdeas.length > 0 && selectedMeasures.length >= 2 ? (
                        <DensityOverlay ideas={priorityIdeas} measures={selectedMeasures} size={160} />
                      ) : (
                        <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)', fontSize: 12, fontStyle: 'italic', background: 'var(--c-ground)', borderRadius: 8, border: '1px dashed var(--c-border)' }}>
                          No ideas
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{priorityIdeas.length} idea{priorityIdeas.length !== 1 ? 's' : ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual idea cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {filteredIdeas.map(idea => {
                const tagColor = getIdeaColor(idea, tags) ?? (colorByThemeId && colorByThemeId !== '__priority__' ? 'var(--c-text-3)' : undefined);
                const borderColor = tagColor && tagColor !== 'var(--c-text-3)' ? tagColor : undefined;
                const spiderColor = tagColor ?? 'var(--c-accent)';
                const ideaTag = colorByThemeId && colorByThemeId !== '__priority__'
                  ? tags.find(t => t.id === idea.tagsByTheme?.[colorByThemeId])
                  : colorByThemeId === '__priority__'
                  ? { label: PRIORITY_CHIPS.find(c => c.value === (idea.priority ?? 'not-planned'))?.label ?? '', color: PRIORITY_CHIPS.find(c => c.value === (idea.priority ?? 'not-planned'))?.color ?? 'var(--c-not-planned)' }
                  : null;
                return (
                  <div
                    key={idea.id}
                    onClick={() => onDrill(idea, [])}
                    style={{
                      position: 'relative',
                      background: 'var(--c-surface)', borderRadius: 10, padding: '12px 12px 8px',
                      boxShadow: 'var(--e-1)', cursor: 'pointer',
                      transition: 'box-shadow 0.15s',
                      border: `2px solid ${borderColor ?? 'transparent'}`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(59,130,246,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--e-1)'; }}
                  >
                    {ideaTag && (
                      <div style={{
                        position: 'absolute', top: 6, right: 8,
                        background: ideaTag.color + '22',
                        border: `1px solid ${ideaTag.color}`,
                        borderRadius: 6, padding: '1px 4px',
                        fontSize: 9, fontWeight: 600, color: 'var(--c-text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ideaTag.label}
                      </div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      {idea.shortlisted && <span style={{ color: 'var(--c-accent)', fontSize: 12 }}>★</span>}
                      {idea.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                      <SpiderChart
                        idea={idea}
                        measures={selectedMeasures}
                        size={180}
                        color={spiderColor}
                        draggable
                        onValueChange={(measureId, newValue) => {
                          onUpdateIdea({ ...idea, values: { ...idea.values, [measureId]: newValue } });
                        }}
                      />
                    </div>
                    {idea.comments && (
                      <div style={{ fontSize: 11, color: 'var(--c-text-3)', textAlign: 'center', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idea.comments}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

      {abstractOpen && (
        <Modal title="The abstract" width={640} onClose={() => setAbstractOpen(false)}>
          <BalanceReadout ideas={filteredIdeas} measures={measures} bare />
        </Modal>
      )}
    </div>
  );
}
