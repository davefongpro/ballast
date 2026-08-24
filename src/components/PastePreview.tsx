import type { PastePlan } from '../utils/paste';
import { Button, Modal, Notice } from './ui';

/**
 * Nothing pasted or imported commits until this has been seen. The preview exists
 * because the failure it prevents is silent: the previous behaviour dropped rows
 * past the end of the table and non-numeric cells without saying so, which looks
 * identical to a successful paste.
 */
export function PastePreview({
  plan,
  source,
  acceptedHeaders,
  onToggleProposed,
  onConfirm,
  onCancel,
}: {
  plan: PastePlan;
  source: 'paste' | 'import';
  /** Headers of proposed measures the user has agreed to create. */
  acceptedHeaders?: string[];
  onToggleProposed?: (header: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const verb = source === 'paste' ? 'Paste' : 'Import';
  const nothingToDo = plan.newIdeas.length === 0 && plan.updates.length === 0;
  const changedCells = plan.updates.reduce((n, u) => n + u.changes.length, 0);

  if (plan.fatalError) {
    return (
      <Modal
        title={`${verb} not applied`}
        onClose={onCancel}
        footer={<Button variant="primary" onClick={onCancel}>Close</Button>}
      >
        <Notice tone="danger" title="Nothing was changed">{plan.fatalError}</Notice>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Review this ${source}`}
      width={640}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm} disabled={nothingToDo}>
            {nothingToDo ? 'Nothing to apply' : `Apply ${verb.toLowerCase()}`}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 'var(--s-4)' }}>
        <div className="row" style={{ gap: 'var(--s-5)', flexWrap: 'wrap' }}>
          <Stat value={plan.newIdeas.length} label={plan.newIdeas.length === 1 ? 'new idea' : 'new ideas'} />
          <Stat value={changedCells} label={changedCells === 1 ? 'value changed' : 'values changed'} />
            <Stat value={plan.newMeasures.length} label={plan.newMeasures.length === 1 ? 'new measure' : 'new measures'} />
          <Stat value={plan.rejections.length} label="not accepted" tone={plan.rejections.length ? 'warn' : undefined} />
        </div>

        <p className="subtle" style={{ margin: 0 }}>
          {plan.mode === 'table'
            ? 'Read as a table — columns were matched to fields and measures by their header names.'
            : 'Read as a block of values — filled right and down from the cell you were on.'}
        </p>

        {plan.placeholderNameCount > 0 && (
          <Notice tone="warn" title={`${plan.placeholderNameCount} new ${plan.placeholderNameCount === 1 ? 'row has' : 'rows have'} a placeholder name`}>
            {plan.mode === 'block'
              ? 'The pasted block ran past the end of the table and had no name column, so these are named "Untitled". Rename them in the Name column.'
              : 'These rows had no value in the name column.'}
          </Notice>
        )}

        {plan.proposedMeasures.length > 0 && onToggleProposed && (
          <Section title={`New measures these columns imply (${plan.proposedMeasures.length})`}>
            <p className="subtle" style={{ margin: '0 0 var(--s-2)' }}>
              These columns have numbers in them but no measure defined. Tick one to create it as part of this paste —
              the counts above update as you choose.
            </p>
            <div className="stack" style={{ gap: 'var(--s-2)' }}>
              {plan.proposedMeasures.map(p => {
                const on = acceptedHeaders?.includes(p.header) ?? false;
                return (
                  <label key={p.header} className="row" style={{ gap: 'var(--s-3)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => onToggleProposed(p.header)} />
                    <span>
                      <strong>{p.header}</strong>{' '}
                      <span className="subtle mono" style={{ fontSize: 'var(--t-xs)' }}>
                        {p.measure.min}–{p.measure.max}, higher is better
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Section>
        )}

        {plan.unmappedColumns.length > 0 && (
          <Notice tone="warn" title="Columns that were not used">
            <span className="notice__body">
              {plan.unmappedColumns.join(', ')} — nothing here has these names, and their values are not numbers, so they
              cannot become measures. Add a category with a matching name on the Measures tab, then paste again.
            </span>
          </Notice>
        )}

        {plan.newIdeas.length > 0 && (
          <Section title={`New ideas (${plan.newIdeas.length})`}>
            <ul className="stack" style={{ margin: 0, paddingLeft: 'var(--s-5)', gap: 'var(--s-1)' }}>
              {plan.newIdeas.slice(0, 12).map(idea => <li key={idea.id}>{idea.name}</li>)}
              {plan.newIdeas.length > 12 && <li className="subtle">…and {plan.newIdeas.length - 12} more</li>}
            </ul>
          </Section>
        )}

        {plan.updates.length > 0 && (
          <Section title={`Changed (${plan.updates.length} ${plan.updates.length === 1 ? 'idea' : 'ideas'})`}>
            <div className="stack" style={{ gap: 'var(--s-2)' }}>
              {plan.updates.slice(0, 10).map(update => (
                <div key={update.ideaId}>
                  <div style={{ fontWeight: 600 }}>{update.ideaName}</div>
                  <div className="subtle mono" style={{ fontSize: 'var(--t-sm)' }}>
                    {update.changes.slice(0, 6).map(c => `${c.label} ${c.from} → ${c.to}`).join(' · ')}
                    {update.changes.length > 6 && ` · +${update.changes.length - 6} more`}
                  </div>
                </div>
              ))}
              {plan.updates.length > 10 && <div className="subtle">…and {plan.updates.length - 10} more ideas</div>}
            </div>
          </Section>
        )}

        {plan.rejections.length > 0 && (
          <Section title={`Not accepted (${plan.rejections.length})`}>
            <div className="stack" style={{ gap: 'var(--s-1)' }}>
              {plan.rejections.slice(0, 10).map((r, i) => (
                <div key={i} style={{ fontSize: 'var(--t-sm)' }}>
                  <span className="mono">{r.where}</span> <span className="muted">— {r.reason}</span>
                </div>
              ))}
              {plan.rejections.length > 10 && <div className="subtle">…and {plan.rejections.length - 10} more</div>}
            </div>
          </Section>
        )}
      </div>
    </Modal>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'warn' }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--t-2xl)', fontWeight: 600, lineHeight: 1, color: tone === 'warn' && value > 0 ? 'var(--c-warn)' : 'var(--c-text)' }}>
        {value}
      </div>
      <div className="subtle" style={{ fontSize: 'var(--t-sm)' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 'var(--s-2)' }}>
      <h4 style={{ fontSize: 'var(--t-sm)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--c-text-subtle)' }}>{title}</h4>
      {children}
    </div>
  );
}
