import { useState, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { Idea, Measure } from '../../types';
import { normalizedForScatter, clampToRange } from '../../utils/normalize';
import { AxisLabels } from './AxisLabels';
import { labelPad } from '../../utils/axisLabels';

interface Props {
  idea: Idea;
  measures: Measure[];
  size?: number;
  color?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  draggable?: boolean;
  onValueChange?: (measureId: string, newValue: number) => void;
}

const LEVELS = 4;

export function SpiderChart({
  idea, measures, size = 200, color = 'var(--c-accent)',
  fillOpacity, strokeOpacity, draggable = false, onValueChange,
}: Props) {
  // The SVG is as wide as the ring plus the labels either side, so the chart
  // occupies the space it actually draws in and cannot overlap its neighbour.
  const pad = labelPad(size, measures);
  const width = size + pad * 2;
  const cx = size / 2 + pad;
  const cy = size / 2;
  const r = size * 0.32;
  const n = measures.length;

  const [liveValues, setLiveValues] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ idx: number; measureId: string; min: number; max: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (n < 3) {
    return (
      <div style={{ width, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--c-text-3)', textAlign: 'center', padding: 8 }}>
        Choose at least 3 measures to draw a profile
      </div>
    );
  }

  const angle = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;
  const point = (i: number, frac: number) => ({
    x: cx + r * frac * Math.cos(angle(i)),
    y: cy + r * frac * Math.sin(angle(i)),
  });

  const gridPolygon = (frac: number) =>
    Array.from({ length: n }, (_, i) => point(i, frac))
      .map(p => `${p.x},${p.y}`)
      .join(' ');

  const getVal = (m: Measure) =>
    liveValues[m.id] !== undefined ? liveValues[m.id] : (idea.values[m.id] ?? m.min);

  const fracs = measures.map(m => normalizedForScatter(getVal(m), m) / 100);
  const dataPolygon = fracs.map((frac, i) => point(i, frac)).map(p => `${p.x},${p.y}`).join(' ');

  const handleVertexMouseDown = (e: MouseEvent, idx: number, m: Measure) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { idx, measureId: m.id, min: m.min, max: m.max };
    setIsDragging(true);
  };

  const handleSVGMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current || !svgRef.current) return;
    const { idx, measureId, min, max } = dragRef.current;
    const m = measures[idx];
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const a = (2 * Math.PI * idx) / n - Math.PI / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const projection = dx * Math.cos(a) + dy * Math.sin(a);
    const frac = Math.max(0, Math.min(1, projection / r));
    // For goodEnd='low' directional measures the vertex sits outward when the raw
    // value is low (normalizedForScatter inverts). Invert frac so dragging outward
    // correctly decreases the raw value.
    const effectiveFrac = m.type === 'directional' && m.goodEnd === 'low' ? 1 - frac : frac;
    const newValue = clampToRange(effectiveFrac * (max - min) + min, min, max);
    setLiveValues(prev => ({ ...prev, [measureId]: newValue }));
  };

  const commitDrag = () => {
    if (!dragRef.current) return;
    const { measureId, min, max } = dragRef.current;
    setLiveValues(prev => {
      const newValue = prev[measureId];
      if (newValue !== undefined && onValueChange) {
        onValueChange(measureId, clampToRange(newValue, min, max));
      }
      return {};
    });
    dragRef.current = null;
    setIsDragging(false);
  };

  const fO = fillOpacity !== undefined ? fillOpacity : 0.18;
  const sO = strokeOpacity !== undefined ? strokeOpacity : 1;
  const activeDragIdx = isDragging ? dragRef.current?.idx : undefined;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={size}
      style={{ overflow: 'visible', cursor: isDragging ? 'grabbing' : 'default' }}
      onMouseMove={draggable ? handleSVGMouseMove : undefined}
      onMouseUp={draggable ? commitDrag : undefined}
      onMouseLeave={draggable ? commitDrag : undefined}
    >
      {/* Grid rings */}
      {Array.from({ length: LEVELS }, (_, lvl) => {
        const frac = (lvl + 1) / LEVELS;
        return (
          <polygon key={lvl} points={gridPolygon(frac)} fill="none"
            stroke={frac === 1 ? 'var(--c-axis)' : 'var(--c-grid)'} strokeWidth={frac === 1 ? 1.5 : 1}
          />
        );
      })}

      {/* Neutral midpoint ring */}
      <polygon points={gridPolygon(0.5)} fill="none" stroke="var(--c-neutral-line)" strokeWidth={1} strokeDasharray="3 3" />

      {/* Spokes */}
      {measures.map((_, i) => {
        const tip = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="var(--c-grid)" strokeWidth={1} />;
      })}

      {/* Filled data polygon */}
      <polygon
        points={dataPolygon}
        fill={color}
        fillOpacity={fO}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={sO}
      />

      {/* Data dots + drag hit targets */}
      {fracs.map((frac, i) => {
        const p = point(i, frac);
        const m = measures[i];
        const isActive = activeDragIdx === i;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} fillOpacity={sO} />
            {draggable && (
              <circle
                cx={p.x} cy={p.y} r={8}
                fill={isActive ? `${color}22` : 'transparent'}
                stroke={isActive ? color : 'transparent'}
                strokeWidth={1.5}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                onMouseDown={e => handleVertexMouseDown(e, i, m)}
              />
            )}
          </g>
        );
      })}

      {/* Axis labels */}
      <AxisLabels cx={cx} cy={cy} r={r} size={size} measures={measures} />

      {/* Live value tooltip during drag — positioned at the actual vertex (uses normalizedForScatter for consistency) */}
      {isDragging && dragRef.current && (() => {
        const { idx, measureId } = dragRef.current;
        const val = liveValues[measureId];
        if (val === undefined) return null;
        const p = point(idx, normalizedForScatter(val, measures[idx]) / 100);
        return (
          <g>
            <rect x={p.x + 8} y={p.y - 13} width={44} height={18} rx={4} fill="var(--c-ground)" fillOpacity={0.88} />
            <text x={p.x + 30} y={p.y - 4} textAnchor="middle" fontSize={11} fill="var(--c-text)" fontWeight={600}>{val}</text>
          </g>
        );
      })()}
    </svg>
  );
}
