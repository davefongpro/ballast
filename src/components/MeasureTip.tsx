import { useEffect, useId, useRef, useState } from 'react';
import type { Measure } from '../types';

/**
 * A measure's name, with its benchmarks readable underneath.
 *
 * Opens three ways — hover, click or tap, and keyboard focus — because the
 * benchmarks are the thing that makes one person's scores legible to another,
 * and hover alone would put them out of reach on a phone and for anyone using a
 * keyboard.
 */
export function MeasureTip({
  measure,
  align = 'left',
  badge,
  children,
}: {
  measure: Measure;
  align?: 'left' | 'right';
  /** Render as a standalone round marker rather than an underlined name. */
  badge?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) { setPinned(false); setOpen(false); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPinned(false); setOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  const range = measure.type === 'bipolar'
    ? `${measure.lowPoleLabel ?? 'low'} ${measure.min} ←→ ${measure.max} ${measure.highPoleLabel ?? 'high'}`
    : `${measure.min}–${measure.max} · ${measure.goodEnd === 'low' ? 'lower is better' : 'higher is better'}`;

  return (
    <span className="tip" ref={wrap}>
      <button
        type="button"
        className={badge ? 'tip__trigger tip__trigger--badge' : 'tip__trigger'}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        onClick={() => { setPinned(p => !p); setOpen(true); }}
      >
        {badge
          ? <span className="tip__badge" aria-hidden="true">?</span>
          : (children ?? measure.name)}
        {badge && <span className="visually-hidden">What {measure.name} means</span>}
      </button>
      {open && (
        <span className={`tip__panel${align === 'right' ? ' tip__panel--right' : ''}`} id={id} role="tooltip">
          <span className="tip__name">{measure.name}</span>
          <span className="tip__meta">{range}</span>
          {measure.benchmarks?.trim()
            ? <span className="tip__marks">{measure.benchmarks}</span>
            : <span className="tip__empty">No benchmarks written yet. Add them on the Measures tab so a score means the same thing to whoever reads it next.</span>}
        </span>
      )}
    </span>
  );
}
