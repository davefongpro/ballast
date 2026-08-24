import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Label,
} from 'recharts';
import type { Idea, Measure, Theme, Tag, Priority } from '../../types';
import { FilterBar } from '../FilterBar';
import { Collapsible, Toolbar, ToolbarGroup } from '../ui';
import { MeasureTip } from '../MeasureTip';
import { normalizedForScatter, clampToRange } from '../../utils/normalize';

interface Props {
  ideas: Idea[];
  measures: Measure[];
  themes: Theme[];
  tags: Tag[];
  xId: string;
  yId: string;
  sizeId?: string;
  onXChange: (id: string) => void;
  onYChange: (id: string) => void;
  onSizeChange: (id: string | undefined) => void;
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

interface ScatterPoint {
  x: number; y: number; z: number;
  idea: Idea; rawX: number; rawY: number; rawZ?: number;
}

const CHART_PADDING = 16;
const CHART_MARGIN = { top: 30, right: 40, bottom: 40, left: 20 };
const Y_AXIS_WIDTH = 42;
const X_AXIS_HEIGHT = 30;

function denormalize(norm: number, measure: Measure): number {
  let frac = norm / 100;
  if (measure.type === 'directional' && measure.goodEnd === 'low') frac = 1 - frac;
  return clampToRange(frac * (measure.max - measure.min) + measure.min, measure.min, measure.max);
}


function CustomDot(props: any) {
  const { cx, cy, payload, onDotClick, onDragStart, draggedId, color, sizeMeasure, dataZMin, dataZMax } = props;
  const isDragged = draggedId === payload.idea.id;
  const dotColor = color ?? 'var(--c-accent)';
  let r = 7;
  if (sizeMeasure) {
    const range = Math.max(1, dataZMax - dataZMin);
    const norm = Math.max(0, Math.min(1, (payload.z - dataZMin) / range));
    r = 4 + Math.pow(norm, 0.8) * 14;
  }
  return (
    <g
      style={{ cursor: isDragged ? 'grabbing' : 'grab' }}
      onMouseDown={e => onDragStart(payload.idea, e)}
      onClick={e => {
        e.stopPropagation();
        onDotClick(payload, e.clientX, e.clientY);
      }}
    >
      <circle cx={cx} cy={cy} r={r} fill={dotColor} fillOpacity={0.75} stroke={dotColor} strokeWidth={1.5} />
      <text x={cx} y={cy - (r + 6)} textAnchor="middle" fontSize={11} fill="var(--c-text)" fontWeight={600}>
        {payload.idea.name.length > 14 ? payload.idea.name.slice(0, 13) + '…' : payload.idea.name}
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload, xMeasure, yMeasure, sizeMeasure }: any) {
  if (!active || !payload?.[0]) return null;
  const d: ScatterPoint = payload[0].payload;
  const desc = d.idea.description;
  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--e-2)', fontSize: 13, maxWidth: 260 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--c-text)' }}>{d.idea.name}</div>
      {xMeasure && <div style={{ color: 'var(--c-text-2)' }}>X — {xMeasure.name}: <strong>{d.rawX}</strong></div>}
      {yMeasure && <div style={{ color: 'var(--c-text-2)' }}>Y — {yMeasure.name}: <strong>{d.rawY}</strong></div>}
      {sizeMeasure && d.rawZ !== undefined && <div style={{ color: 'var(--c-text-2)' }}>Size — {sizeMeasure.name}: <strong>{d.rawZ}</strong></div>}
      {desc && <div style={{ color: 'var(--c-text-3)', fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{desc.length > 80 ? desc.slice(0, 80) + '…' : desc}</div>}
    </div>
  );
}

function MeasureSelect({ value, measures, onChange, placeholder }: { value: string; measures: Measure[]; onChange: (v: string) => void; placeholder?: string }) {
  const chosen = measures.find(m => m.id === value);
  return (
    <span className="row" style={{ gap: 'var(--s-2)' }}>
      <select
        className="select"
        style={{ minWidth: 132 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Measure"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {measures.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {chosen && <MeasureTip measure={chosen} badge />}
    </span>
  );
}



export function MapTab({ ideas, measures, themes, tags, xId, yId, sizeId, onXChange, onYChange, onSizeChange, onDrill, onUpdateIdea, shortlistFilter, onShortlistFilterChange, colorByThemeId, onColorByChange, priorityFilter, onPriorityFilterToggle, getIdeaColor }: Props) {
  const xMeasure = measures.find(m => m.id === xId);
  const yMeasure = measures.find(m => m.id === yId);
  const sizeMeasure = measures.find(m => m.id === sizeId);

  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [stackedPicker, setStackedPicker] = useState<{ ideas: Idea[]; clientX: number; clientY: number } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ ideaId: string; xMeasure: Measure; yMeasure: Measure } | null>(null);
  const [dragOverrides, setDragOverrides] = useState<Record<string, { normX: number; normY: number }>>({});
  const dragMovedRef = useRef(false);
  const setDragOverridesRef = useRef(setDragOverrides);
  setDragOverridesRef.current = setDragOverrides;
  const ideasRef = useRef(ideas);
  const onUpdateIdeaRef = useRef(onUpdateIdea);
  ideasRef.current = ideas;
  onUpdateIdeaRef.current = onUpdateIdea;

  const activeFilters = Object.entries(filterState).filter(([, v]) => v !== '');
  const filteredIdeas = ideas
    .filter(idea => !shortlistFilter || idea.shortlisted)
    .filter(idea => activeFilters.every(([themeId, tagId]) => idea.tagsByTheme?.[themeId] === tagId))
    .filter(idea => priorityFilter.length === 0 || priorityFilter.includes(idea.priority ?? 'not-planned'));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current || !chartContainerRef.current) return;
      const { ideaId, xMeasure: xM, yMeasure: yM } = dragStateRef.current;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const plotLeft = rect.left + CHART_PADDING + CHART_MARGIN.left + Y_AXIS_WIDTH;
      const plotRight = rect.right - CHART_PADDING - CHART_MARGIN.right;
      const plotTop = rect.top + CHART_PADDING + CHART_MARGIN.top;
      const plotBottom = rect.bottom - CHART_PADDING - CHART_MARGIN.bottom - X_AXIS_HEIGHT;
      const plotWidth = plotRight - plotLeft;
      const plotHeight = plotBottom - plotTop;
      const normX = Math.max(0, Math.min(100, ((e.clientX - plotLeft) / plotWidth) * 100));
      const normY = Math.max(0, Math.min(100, (1 - (e.clientY - plotTop) / plotHeight) * 100));
      const rawX = denormalize(normX, xM);
      const rawY = denormalize(normY, yM);
      const clampedNormX = normalizedForScatter(rawX, xM);
      const clampedNormY = normalizedForScatter(rawY, yM);
      dragMovedRef.current = true;
      setDragOverridesRef.current({ [ideaId]: { normX: clampedNormX, normY: clampedNormY } });
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current) return;
      const { ideaId, xMeasure: xM, yMeasure: yM } = dragStateRef.current;
      if (dragMovedRef.current) {
        setDragOverridesRef.current(prev => {
          const override = prev[ideaId];
          if (override) {
            const idea = ideasRef.current.find(i => i.id === ideaId);
            if (idea) {
              onUpdateIdeaRef.current({
                ...idea,
                values: {
                  ...idea.values,
                  [xM.id]: denormalize(override.normX, xM),
                  [yM.id]: denormalize(override.normY, yM),
                },
              });
            }
          }
          return {};
        });
      }
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDragStart = useCallback((idea: Idea, e: React.MouseEvent) => {
    if (!xMeasure || !yMeasure) return;
    e.stopPropagation();
    dragMovedRef.current = false;
    dragStateRef.current = { ideaId: idea.id, xMeasure, yMeasure };
  }, [xMeasure, yMeasure]);

  const scatterData: ScatterPoint[] = filteredIdeas.map(idea => {
    const override = dragOverrides[idea.id];
    const rawX = idea.values[xId] ?? (xMeasure?.min ?? 0);
    const rawY = idea.values[yId] ?? (yMeasure?.min ?? 0);
    const rawZ = sizeId ? (idea.values[sizeId] ?? (sizeMeasure?.min ?? 1)) : undefined;
    return {
      x: override ? override.normX : (xMeasure ? normalizedForScatter(rawX, xMeasure) : rawX),
      y: override ? override.normY : (yMeasure ? normalizedForScatter(rawY, yMeasure) : rawY),
      z: rawZ ?? 1,
      idea,
      rawX: override ? denormalize(override.normX, xMeasure!) : rawX,
      rawY: override ? denormalize(override.normY, yMeasure!) : rawY,
      rawZ,
    };
  });

  const canRender = xMeasure && yMeasure && filteredIdeas.length > 0;

  const { dataZMin, dataZMax } = useMemo(() => {
    if (!sizeMeasure || scatterData.length === 0) return { dataZMin: 0, dataZMax: 1 };
    const zVals = scatterData.map(p => p.z);
    return { dataZMin: Math.min(...zVals), dataZMax: Math.max(...zVals) };
  }, [sizeMeasure, scatterData]);

  const stackGroups = useMemo(() => {
    const map = new Map<string, ScatterPoint[]>();
    scatterData.forEach(pt => {
      const key = `${pt.x}-${pt.y}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pt);
    });
    return map;
  }, [scatterData]);

  const handleDotClick = useCallback((payload: ScatterPoint, clientX: number, clientY: number) => {
    if (dragMovedRef.current) return;
    const key = `${payload.x}-${payload.y}`;
    const group = stackGroups.get(key);
    if (group && group.length > 1) {
      setStackedPicker({ ideas: group.map(p => p.idea), clientX, clientY });
      return;
    }
    const excludeIds = [xId, yId, sizeId].filter(Boolean) as string[];
    onDrill(payload.idea, excludeIds);
  }, [xId, yId, sizeId, onDrill, stackGroups]);

  // B-1 fix: X always shows →, Y always shows ↑ (normalized axes always go left→right and bottom→top)
  const xAxisLabel = xMeasure
    ? `${xMeasure.name}${xMeasure.type === 'directional' ? ' →' : ''}`
    : 'Select X measure';
  const yAxisLabel = yMeasure
    ? `${yMeasure.name}${yMeasure.type === 'directional' ? ' ↑' : ''}`
    : 'Select Y measure';

  const hasShortlisted = ideas.some(i => i.shortlisted);

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Map</h2>
        <p className="page-sub">
          {sizeMeasure ? 'Three measures — two axes and bubble size.' : 'Two measures, one on each axis.'}
          {' '}Tap a point to open it, or drag it to change its values.
        </p>
      </div>

      <Toolbar>
        <ToolbarGroup label="X axis">
          <MeasureSelect value={xId} measures={measures} onChange={onXChange} />
        </ToolbarGroup>
        <ToolbarGroup label="Y axis">
          <MeasureSelect value={yId} measures={measures} onChange={onYChange} />
        </ToolbarGroup>
        <ToolbarGroup label="Bubble size">
          <MeasureSelect value={sizeId ?? ''} measures={measures} onChange={v => onSizeChange(v || undefined)} placeholder="— none —" />
        </ToolbarGroup>
      </Toolbar>

      <Collapsible summary="Filters">
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
      </Collapsible>

      {!canRender ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--c-text-3)' }}>
          {filteredIdeas.length === 0 && ideas.length > 0
            ? shortlistFilter
              ? 'No shortlisted ideas. Star ideas in the Data tab to shortlist them.'
              : 'No ideas match the current filter.'
            : ideas.length === 0
            ? 'Add ideas in the Data tab to see them plotted here.'
            : measures.length < 2
            ? 'Add at least 2 measures to plot a chart.'
            : 'Select X and Y measures above.'}
        </div>
      ) : (
        <div className="card" ref={chartContainerRef} style={{ padding: CHART_PADDING }}>
          <ResponsiveContainer width="100%" height={480}>
            <ScatterChart margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-grid)" />
              <XAxis type="number" dataKey="x" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--c-text-3)' }}>
                <Label value={xAxisLabel} offset={-10} position="insideBottom" style={{ fontSize: 12, fill: 'var(--c-text-2)', fontWeight: 600 }} />
              </XAxis>
              <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--c-text-3)' }}>
                <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={10} style={{ fontSize: 12, fill: 'var(--c-text-2)', fontWeight: 600 }} />
              </YAxis>
              {sizeMeasure && <ZAxis type="number" dataKey="z" range={[60, 600]} name={sizeMeasure.name} />}
              <Tooltip content={<CustomTooltip xMeasure={xMeasure} yMeasure={yMeasure} sizeMeasure={sizeMeasure} />} />
              <Scatter
                data={scatterData}
                isAnimationActive={false}
                shape={(props: any) => (
                  <CustomDot
                    {...props}
                    onDotClick={handleDotClick}
                    onDragStart={handleDragStart}
                    draggedId={dragStateRef.current?.ideaId}
                    color={getIdeaColor(props.payload.idea, tags) ?? (colorByThemeId ? 'var(--c-text-3)' : 'var(--c-accent)')}
                    sizeMeasure={sizeMeasure}
                    dataZMin={dataZMin}
                    dataZMax={dataZMax}
                  />
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>

          {sizeMeasure && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--c-text-3)', marginTop: 4 }}>
              Bubble size = {sizeMeasure.name} ({sizeMeasure.min}–{sizeMeasure.max})
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--c-text-3)', textAlign: 'center' }}>
            Axes normalized to 0–100. Click to edit · Drag to reposition.
          </div>
        </div>
      )}

      {stackedPicker && (
        <>
          <div onClick={() => setStackedPicker(null)} style={{ position: 'fixed', inset: 0, zIndex: 500 }} />
          <div
            style={{
              position: 'fixed',
              left: stackedPicker.clientX + 10,
              top: stackedPicker.clientY - 10,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 8,
              padding: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              zIndex: 501,
              minWidth: 140,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {stackedPicker.ideas.length} overlapping ideas
            </div>
            {stackedPicker.ideas.map(idea => (
              <div
                key={idea.id}
                onClick={() => {
                  setStackedPicker(null);
                  const excludeIds = [xId, yId, sizeId].filter(Boolean) as string[];
                  onDrill(idea, excludeIds);
                }}
                style={{ padding: '5px 8px', cursor: 'pointer', borderRadius: 5, fontSize: 13, color: 'var(--c-text)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {idea.name}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
