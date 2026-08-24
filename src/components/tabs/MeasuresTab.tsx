import { useMemo, useState } from 'react';
import type { Measure, MeasureType, GoodEnd, Theme, Tag } from '../../types';
import { TAG_COLORS } from '../../utils/tagColors';
import { makeId } from '../../utils/ids';
import { downloadCSV } from '../../utils/csvUtils';
import { parseClipboardGrid } from '../../utils/paste';
import { planMeasurePaste, applyMeasurePaste, measureTemplateCSV } from '../../utils/measurePaste';
import { Button, Card, Modal, Notice, Toolbar, ToolbarGroup } from '../ui';
import type { Doc } from '../../state/useDoc';

interface Props {
  doc: Doc;
  onAdd: (m: Measure) => void;
  onUpdate: (m: Measure) => void;
  onDelete: (id: string) => void;
  onAddTheme: (t: Theme) => void;
  onUpdateTheme: (t: Theme) => void;
  onDeleteTheme: (id: string) => void;
  onAddTag: (t: Tag) => void;
  onUpdateTag: (t: Tag) => void;
  onDeleteTag: (id: string) => void;
  onApplyPaste: (next: Doc, label: string) => void;
}

const blankMeasure = (): Measure => ({
  id: makeId('m'), name: '', type: 'directional', min: 1, max: 10, goodEnd: 'high', goodDefinition: '', benchmarks: '',
});

/* ------------------------------------------------------------------ editor */

function MeasureEditor({
  measure, onSave, onCancel,
}: { measure: Measure; onSave: (m: Measure) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Measure>(measure);
  const set = <K extends keyof Measure>(k: K, v: Measure[K]) => setDraft(d => ({ ...d, [k]: v }));
  const valid = draft.name.trim() !== ''
    && draft.min < draft.max
    && (draft.type === 'directional' || (!!draft.lowPoleLabel?.trim() && !!draft.highPoleLabel?.trim()));

  return (
    <div className="stack" style={{ gap: 'var(--s-4)' }}>
      <div className="field">
        <label className="field__label" htmlFor="m-name">Name</label>
        <input
          id="m-name"
          className="input"
          autoFocus
          value={draft.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Value, Effort, Horizon…"
        />
      </div>

      <div className="field">
        <span className="field__label">Kind</span>
        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <Button
            variant={draft.type === 'directional' ? 'primary' : 'default'}
            onClick={() => set('type', 'directional' as MeasureType)}
          >
            One end is better
          </Button>
          <Button
            variant={draft.type === 'bipolar' ? 'primary' : 'default'}
            onClick={() => set('type', 'bipolar' as MeasureType)}
          >
            Two ends, no winner
          </Button>
        </div>
        <span className="field__hint">
          {draft.type === 'directional'
            ? 'A scale where higher or lower is the better answer — Value, Effort, Confidence.'
            : 'A tradeoff with a name at each end and no better side — Quick fix ↔ Structural.'}
        </span>
      </div>

      <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 96 }}>
          <label className="field__label" htmlFor="m-min">Min</label>
          <input id="m-min" className="input" type="number" value={draft.min} onChange={e => set('min', Number(e.target.value))} />
        </div>
        <div className="field" style={{ width: 96 }}>
          <label className="field__label" htmlFor="m-max">Max</label>
          <input id="m-max" className="input" type="number" value={draft.max} onChange={e => set('max', Number(e.target.value))} />
        </div>
      </div>

      {draft.type === 'directional' ? (
        <div className="field">
          <span className="field__label">Which end is better</span>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <Button variant={draft.goodEnd === 'high' ? 'primary' : 'default'} onClick={() => set('goodEnd', 'high' as GoodEnd)}>Higher</Button>
            <Button variant={draft.goodEnd === 'low' ? 'primary' : 'default'} onClick={() => set('goodEnd', 'low' as GoodEnd)}>Lower</Button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label className="field__label" htmlFor="m-low">Name for the low end</label>
            <input id="m-low" className="input" value={draft.lowPoleLabel ?? ''} onChange={e => set('lowPoleLabel', e.target.value)} placeholder="Quick fix" />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label className="field__label" htmlFor="m-high">Name for the high end</label>
            <input id="m-high" className="input" value={draft.highPoleLabel ?? ''} onChange={e => set('highPoleLabel', e.target.value)} placeholder="Structural" />
          </div>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="m-bench">Benchmarks — what the numbers mean</label>
        <textarea
          id="m-bench"
          className="textarea"
          style={{ minHeight: 84 }}
          value={draft.benchmarks ?? ''}
          onChange={e => set('benchmarks', e.target.value)}
          placeholder={draft.type === 'bipolar'
            ? `${draft.min} = ${draft.lowPoleLabel || 'the low end'} · ${draft.max} = ${draft.highPoleLabel || 'the high end'}`
            : `${draft.min} = no measurable effect · ${Math.round((draft.min + draft.max) / 2)} = moves a secondary metric · ${draft.max} = moves a top-line metric`}
        />
        <span className="field__hint">
          Read wherever this measure's name appears. This is what makes your score mean the same thing to whoever
          reads it next — including you, in three months.
        </span>
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>Save measure</Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- measure card */

function MeasureCard({ measure, onEdit, onDelete }: { measure: Measure; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const range = measure.type === 'bipolar'
    ? `${measure.lowPoleLabel ?? 'low'} ${measure.min} ←→ ${measure.max} ${measure.highPoleLabel ?? 'high'}`
    : `${measure.min}–${measure.max} · ${measure.goodEnd === 'low' ? 'lower is better' : 'higher is better'}`;

  return (
    <div className="card">
      <div className="card__head">
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="card__title">
            {measure.protected && <span title="Built in — cannot be deleted" aria-label="Built in">🔒 </span>}
            {measure.name}
          </span>
          <span className="mono subtle" style={{ fontSize: 'var(--t-xs)' }}>{range}</span>
        </div>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <Button size="sm" onClick={onEdit}>Edit</Button>
          {confirming ? (
            <>
              <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={measure.protected}
              title={measure.protected ? 'Built-in measures cannot be deleted' : undefined}
              onClick={() => setConfirming(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
      <div className="card__body">
        {measure.benchmarks?.trim()
          ? <p className="mono" style={{ margin: 0, fontSize: 'var(--t-xs)', color: 'var(--c-text-2)', whiteSpace: 'pre-line' }}>{measure.benchmarks}</p>
          : (
            <p className="subtle" style={{ margin: 0, fontStyle: 'italic' }}>
              No benchmarks yet. Without them, a 7 on this measure means whatever the reader assumes it means.
            </p>
          )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- themes */

function ThemeSection({
  theme, tags, onUpdateTheme, onDeleteTheme, onAddTag, onUpdateTag, onDeleteTag,
}: {
  theme: Theme;
  tags: Tag[];
  onUpdateTheme: (t: Theme) => void;
  onDeleteTheme: (id: string) => void;
  onAddTag: (t: Tag) => void;
  onUpdateTag: (t: Tag) => void;
  onDeleteTag: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const themeTags = tags.filter(t => t.themeId === theme.id);

  return (
    <Card
      title={
        <input
          className="input"
          style={{ minHeight: 30, fontWeight: 600, maxWidth: 220 }}
          value={theme.name}
          onChange={e => onUpdateTheme({ ...theme, name: e.target.value })}
          aria-label="Category name"
        />
      }
      actions={
        confirming ? (
          <>
            <Button size="sm" variant="danger" onClick={() => { onDeleteTheme(theme.id); setConfirming(false); }}>Delete category</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>Delete</Button>
        )
      }
    >
      <div className="stack" style={{ gap: 'var(--s-2)' }}>
        {themeTags.map(tag => (
          <div key={tag.id} className="row" style={{ gap: 'var(--s-2)' }}>
            <input
              type="color"
              value={tag.color}
              onChange={e => onUpdateTag({ ...tag, color: e.target.value })}
              aria-label={`Colour for ${tag.label}`}
              style={{ width: 30, height: 30, padding: 0, border: '1px solid var(--c-border-strong)', borderRadius: 'var(--r-sm)', background: 'none' }}
            />
            <input
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              value={tag.label}
              onChange={e => onUpdateTag({ ...tag, label: e.target.value })}
              aria-label="Label"
            />
            <Button size="sm" variant="ghost" onClick={() => onDeleteTag(tag.id)} aria-label={`Delete ${tag.label}`}>×</Button>
          </div>
        ))}
        <div>
          <Button
            size="sm"
            onClick={() => onAddTag({
              id: makeId('tag'), themeId: theme.id, label: 'New label',
              color: TAG_COLORS[themeTags.length % TAG_COLORS.length],
            })}
          >
            Add label
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------------- tab */

export function MeasuresTab({
  doc, onAdd, onUpdate, onDelete, onAddTheme, onUpdateTheme, onDeleteTheme,
  onAddTag, onUpdateTag, onDeleteTag, onApplyPaste,
}: Props) {
  const { measures, themes, tags } = doc;
  const [editing, setEditing] = useState<Measure | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [reviewText, setReviewText] = useState<string | null>(null);

  const plan = useMemo(
    () => reviewText === null ? null : planMeasurePaste(parseClipboardGrid(reviewText), measures),
    [reviewText, measures],
  );

  const confirmPaste = () => {
    if (!plan) return;
    const next = applyMeasurePaste(plan, measures);
    const added = plan.newMeasures.length;
    const changed = plan.updates.length;
    onApplyPaste({ ...doc, measures: next }, `paste of ${added} new and ${changed} changed measures`);
    setReviewText(null);
    setPasteOpen(false);
    setPasteText('');
  };

  const directional = measures.filter(m => m.type === 'directional');
  const bipolar = measures.filter(m => m.type === 'bipolar');

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Measures</h2>
        <p className="page-sub">
          What you score ideas against. A measure can have a better end, or two named ends and no better one — the second
          kind is what most frameworks throw away. Write the benchmarks and your scores stop being private opinions.
        </p>
      </div>

      <Toolbar>
        <ToolbarGroup>
          <Button variant="primary" onClick={() => setEditing(blankMeasure())}>Add measure</Button>
          <Button onClick={() => setPasteOpen(true)}>Paste measures</Button>
          <Button onClick={() => downloadCSV(measureTemplateCSV(), 'ballast-measures-template.csv')}>Template</Button>
        </ToolbarGroup>
      </Toolbar>

      {bipolar.length === 0 && (
        <Notice tone="info" title="No tradeoff measures yet">
          <span className="notice__body">
            Every measure here has a better end, so nothing on the Profiles tab can tell you which way your portfolio
            leans. Add one with two named ends — Quick fix ↔ Structural, Internal ↔ Customer-facing — and the balance
            readout starts working.
          </span>
        </Notice>
      )}

      <section className="stack" style={{ gap: 'var(--s-3)' }}>
        <h3 className="eyebrow">Tradeoffs · two ends, no winner ({bipolar.length})</h3>
        {bipolar.length === 0
          ? <p className="subtle" style={{ margin: 0 }}>None yet.</p>
          : bipolar.map(m => (
              <MeasureCard key={m.id} measure={m} onEdit={() => setEditing(m)} onDelete={() => onDelete(m.id)} />
            ))}
      </section>

      <section className="stack" style={{ gap: 'var(--s-3)' }}>
        <h3 className="eyebrow">Scored · one end is better ({directional.length})</h3>
        {directional.map(m => (
          <MeasureCard key={m.id} measure={m} onEdit={() => setEditing(m)} onDelete={() => onDelete(m.id)} />
        ))}
      </section>

      <section className="stack" style={{ gap: 'var(--s-3)' }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
          <h3 className="eyebrow">Categories · for filtering and colour ({themes.length})</h3>
          <Button size="sm" onClick={() => onAddTheme({ id: makeId('th'), name: 'New category' })}>Add category</Button>
        </div>
        {themes.map(theme => (
          <ThemeSection
            key={theme.id}
            theme={theme}
            tags={tags}
            onUpdateTheme={onUpdateTheme}
            onDeleteTheme={onDeleteTheme}
            onAddTag={onAddTag}
            onUpdateTag={onUpdateTag}
            onDeleteTag={onDeleteTag}
          />
        ))}
      </section>

      {editing && (
        <Modal
          title={measures.some(m => m.id === editing.id) ? `Edit ${editing.name || 'measure'}` : 'New measure'}
          width={600}
          onClose={() => setEditing(null)}
        >
          <MeasureEditor
            measure={editing}
            onCancel={() => setEditing(null)}
            onSave={m => {
              if (measures.some(x => x.id === m.id)) onUpdate(m);
              else onAdd(m);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {pasteOpen && (
        <Modal
          title="Paste measures from a spreadsheet"
          width={620}
          onClose={() => { setPasteOpen(false); setPasteText(''); }}
          footer={
            <>
              <Button onClick={() => { setPasteOpen(false); setPasteText(''); }}>Cancel</Button>
              <Button variant="primary" disabled={!pasteText.trim()} onClick={() => { setReviewText(pasteText); setPasteOpen(false); }}>Continue</Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 'var(--s-3)' }}>
            <p style={{ margin: 0 }}>
              One row per measure, with a header row naming the columns. A measure whose name already exists is updated
              rather than duplicated.
            </p>
            <p className="mono subtle" style={{ margin: 0, fontSize: 'var(--t-xs)' }}>
              name · kind · min · max · better · low pole · high pole · benchmarks
            </p>
            <textarea
              className="textarea"
              rows={8}
              autoFocus
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'name\tkind\tmin\tmax\tlow pole\thigh pole\nHorizon\tbipolar\t1\t5\tQuick fix\tStructural'}
            />
          </div>
        </Modal>
      )}

      {plan && (
        <Modal
          title="Review these measures"
          width={620}
          onClose={() => setReviewText(null)}
          footer={
            <>
              <Button onClick={() => { setReviewText(null); if (pasteText.trim()) setPasteOpen(true); }}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!!plan.fatalError || (plan.newMeasures.length === 0 && plan.updates.length === 0)}
                onClick={confirmPaste}
              >
                Apply
              </Button>
            </>
          }
        >
          {plan.fatalError ? (
            <Notice tone="danger" title="Nothing was changed"><span className="notice__body">{plan.fatalError}</span></Notice>
          ) : (
            <div className="stack" style={{ gap: 'var(--s-4)' }}>
              <p style={{ margin: 0 }}>
                <strong>{plan.newMeasures.length}</strong> new, <strong>{plan.updates.length}</strong> updated,{' '}
                <strong>{plan.rejections.length}</strong> not accepted.
              </p>
              {plan.newMeasures.length > 0 && (
                <div>
                  <h4 className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>New</h4>
                  <ul style={{ margin: 0, paddingLeft: 'var(--s-5)' }}>
                    {plan.newMeasures.map(m => (
                      <li key={m.id}>
                        {m.name} <span className="subtle mono" style={{ fontSize: 'var(--t-xs)' }}>
                          {m.type === 'bipolar' ? `${m.lowPoleLabel} ←→ ${m.highPoleLabel}` : `${m.min}–${m.max}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.updates.length > 0 && (
                <div>
                  <h4 className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>Updated</h4>
                  <div className="stack" style={{ gap: 'var(--s-2)' }}>
                    {plan.updates.map(u => (
                      <div key={u.id}>
                        <strong>{u.name}</strong>
                        <div className="subtle mono" style={{ fontSize: 'var(--t-xs)' }}>
                          {u.changes.map(c => `${c.label} ${c.from} → ${c.to}`).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {plan.rejections.length > 0 && (
                <Notice tone="warn" title={`Not accepted (${plan.rejections.length})`}>
                  <div className="stack" style={{ gap: 2 }}>
                    {plan.rejections.slice(0, 8).map((r, i) => (
                      <div key={i} className="notice__body"><span className="mono">{r.where}</span> — {r.reason}</div>
                    ))}
                  </div>
                </Notice>
              )}
              {plan.unmappedColumns.length > 0 && (
                <p className="subtle" style={{ margin: 0 }}>Columns ignored: {plan.unmappedColumns.join(', ')}</p>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
