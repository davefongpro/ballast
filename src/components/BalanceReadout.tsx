import { computeBalance } from '../utils/balance';
import type { Idea, Measure } from '../types';

/**
 * The written reading of the bipolar measures — the same thing the density
 * overlay draws, said in sentences.
 *
 * This is what a scoring framework cannot produce, and it is not reliably read
 * off a stack of radar shapes by eye. It lives behind the overlay rather than
 * above it, so the picture stays the picture and the words are one tap away.
 */
export function BalanceReadout({
  ideas,
  measures,
  compact,
  bare,
}: {
  ideas: Idea[];
  measures: Measure[];
  /** One line, for a strip above a chart. */
  compact?: boolean;
  /** Inside a dialog that already supplies the frame and the title. */
  bare?: boolean;
}) {
  const report = computeBalance(ideas, measures);

  if (report.measures.length === 0) {
    if (compact) return null;
    const empty = (
      <p className="muted" style={{ margin: 0 }}>
        No measures with two ends yet. Add one on the Measures tab — a measure with two named ends and no better
        one — and this will read out which way the set leans.
      </p>
    );
    return bare ? empty : <div className="card"><div className="card__body">{empty}</div></div>;
  }

  if (compact) {
    if (!report.headline) return null;
    return (
      <div className="notice notice--info" role="status">
        <strong>Balance:</strong> {report.headline.sentence}
      </div>
    );
  }

  const body = (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      <p className="eyebrow" style={{ margin: 0 }}>
        {report.ideaCount} {report.ideaCount === 1 ? 'idea' : 'ideas'} in view
      </p>

      {report.headline
        ? <p className="abstract">{report.headline.sentence}</p>
        : <p className="abstract">No measure leans strongly — this set is spread across both ends of every tradeoff.</p>}

      <div className="stack" style={{ gap: 'var(--s-3)' }}>
        {report.measures.map(b => (
          <div key={b.measure.id} className="balance-row">
            <div className="balance-poles">
              <span className="balance-name">{b.measure.name}</span>
              <span>{b.lowLabel} ←→ {b.highLabel}</span>
            </div>
            <BalanceBar low={b.lowCount} neutral={b.neutralCount} high={b.highCount} />
            <div className="balance-sentence">{b.sentence}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (bare) return body;

  return (
    <section className="card">
      <header className="card__head">
        <h3 className="card__title">The abstract — what this set leans towards</h3>
      </header>
      <div className="card__body">{body}</div>
    </section>
  );
}

function BalanceBar({ low, neutral, high }: { low: number; neutral: number; high: number }) {
  const total = Math.max(1, low + neutral + high);
  const seg = (n: number, color: string, label: string) =>
    n === 0 ? null : (
      <div title={`${label}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: color, height: '100%' }} />
    );
  return (
    <div
      className="balance-bar"
      role="img"
      aria-label={`${low} on the low pole, ${neutral} near the middle, ${high} on the high pole`}
    >
      {seg(low, 'var(--cat-1)', 'low pole')}
      {seg(neutral, 'var(--c-border-strong)', 'near the middle')}
      {seg(high, 'var(--cat-2)', 'high pole')}
    </div>
  );
}
