import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Idea, Measure, Theme, Tag, Priority } from '../../types';
import { exportCSV, downloadCSV, parseCSV, templateCSV } from '../../utils/csvUtils';
import type { ImportResult } from '../../utils/csvUtils';
import { exportMarkdown, copyToClipboard } from '../../utils/markdownUtils';
import { clampToRange } from '../../utils/normalize';
import { makeId } from '../../utils/ids';
import { checkFileSize } from '../../utils/limits';
import { parseClipboardGrid, planPaste, applyPaste, proposeMeasures } from '../../utils/paste';
import { PastePreview } from '../PastePreview';
import { MeasureTip } from '../MeasureTip';
import { Button, Chip, Modal, Notice, Toolbar, ToolbarGroup } from '../ui';
import type { Doc } from '../../state/useDoc';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'now', label: 'Now', color: 'var(--c-now)' },
  { value: 'next', label: 'Next', color: 'var(--c-next)' },
  { value: 'later', label: 'Later', color: 'var(--c-later)' },
  { value: 'not-planned', label: 'Not planned', color: 'var(--c-not-planned)' },
];

interface Props {
  doc: Doc;
  onUpdateIdea: (idea: Idea, label?: string) => void;
  onDeleteIdea: (id: string) => void;
  onAddIdea: (idea: Idea) => void;
  onImport: (ideas: Idea[], newMeasureNames: string[], themes: Theme[], tags: Tag[], newMeasures: Measure[]) => void;
  /** Commit an approved paste as one undoable step. */
  onApplyPaste: (next: Doc, label: string) => void;
  onLoadSample: () => void;
  onStartEmpty: () => void;
  onOpenModal: (idea: Idea) => void;
  shortlistFilter: boolean;
  onShortlistFilterChange: (v: boolean) => void;
  /** What this value was at the last load, import or reset. */
  baselineValue: (ideaId: string, measureId: string) => number | undefined;
  baselineLabel: string;
  canUndo: boolean;
  undoLabel: string | null;
  onUndo: () => void;
}

/* ---------------- cells ---------------- */

interface EditableCellProps {
  value: number;
  min: number;
  max: number;
  onSave: (v: number) => void;
  autoEdit?: boolean;
  onClearAutoEdit?: () => void;
  onTabNext?: () => void;
  onTabPrev?: () => void;
  onEnterNext?: () => void;
  onEnterPrev?: () => void;
  onFocusCell?: () => void;
  /** Set when this value has changed since the file was last loaded. */
  movedFrom?: number;
  baselineLabel?: string;
}

function EditableCell({
  value, min, max, onSave, autoEdit, onClearAutoEdit,
  onTabNext, onTabPrev, onEnterNext, onEnterPrev, onFocusCell, movedFrom, baselineLabel,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (autoEdit && !editing) { setDraft(String(value)); setEditing(true); setError(false); }
  }, [autoEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (nextAction?: () => void) => {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < min || n > max) { setError(true); return; }
    setError(false);
    onSave(n);
    setEditing(false);
    onClearAutoEdit?.();
    nextAction?.();
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="cell-value"
        onFocus={onFocusCell}
        onClick={() => { onFocusCell?.(); setDraft(String(value)); setEditing(true); setError(false); }}
        title={
          movedFrom !== undefined
            ? `Was ${movedFrom} on ${baselineLabel}. Click to edit (${min}–${max}).`
            : `Click to edit (${min}–${max}). Paste here to fill from a spreadsheet.`
        }
      >
        {value}
        {movedFrom !== undefined && (
          <>
            <span className="cell-value__moved" aria-hidden="true" />
            <span className="visually-hidden">changed from {movedFrom} on {baselineLabel}</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        autoFocus
        type="number"
        className={`cell-input${error ? ' cell-input--error' : ''}`}
        value={draft}
        min={min}
        max={max}
        onChange={e => { setDraft(e.target.value); setError(false); }}
        onBlur={() => commit()}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(onEnterNext); }
          else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); commit(onEnterPrev); }
          else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); commit(onTabNext); }
          else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); commit(onTabPrev); }
          else if (e.key === 'Escape') { setEditing(false); onClearAutoEdit?.(); }
        }}
      />
      {error && <div className="cell-error">Must be {min}–{max}</div>}
    </div>
  );
}

function TextCell({ value, onSave, placeholder, long }: { value: string; onSave: (v: string) => void; placeholder?: string; long?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { onSave(draft); setEditing(false); };

  if (!editing) {
    return (
      <button
        type="button"
        className={`cell-text${value ? '' : ' cell-text--empty'}`}
        onClick={() => { setDraft(value); setEditing(true); }}
        title="Click to edit"
      >
        {value || placeholder || '—'}
      </button>
    );
  }
  return (
    <input
      autoFocus
      className="input"
      style={{ width: long ? 260 : 180 }}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function TagCell({ idea, theme, tags, onSave }: { idea: Idea; theme: Theme; tags: Tag[]; onSave: (tagId: string | null) => void }) {
  const themeTags = tags.filter(t => t.themeId === theme.id);
  const currentTagId = idea.tagsByTheme?.[theme.id] ?? null;
  const current = themeTags.find(t => t.id === currentTagId);
  return (
    <select
      className="select"
      style={{ height: 26, fontSize: 'var(--t-sm)', maxWidth: 150, color: current?.color ?? 'var(--c-text-subtle)' }}
      value={currentTagId ?? ''}
      onChange={e => onSave(e.target.value || null)}
      aria-label={`${theme.name} for ${idea.name}`}
    >
      <option value="">—</option>
      {themeTags.map(tag => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
    </select>
  );
}

/* ---------------- tab ---------------- */

export function DataTab({
  doc, onUpdateIdea, onDeleteIdea, onAddIdea, onImport, onApplyPaste,
  onLoadSample, onStartEmpty, onOpenModal, shortlistFilter, onShortlistFilterChange,
  baselineValue, baselineLabel, canUndo, undoLabel, onUndo,
}: Props) {
  const { ideas, measures, themes, tags } = doc;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);
  const [mdCopied, setMdCopied] = useState(false);
  const [editTarget, setEditTarget] = useState<{ row: number; col: number } | null>(null);
  const [anchor, setAnchor] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false);
  const [pasteBoxText, setPasteBoxText] = useState('');

  // The text under review, and which proposed measures the user has ticked. The
  // plan is derived from both, so what the preview shows and what the commit does
  // can never drift apart.
  const [reviewText, setReviewText] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);

  const displayedIdeas = shortlistFilter ? ideas.filter(i => i.shortlisted) : ideas;
  const hasShortlisted = ideas.some(i => i.shortlisted);

  const plan = useMemo(() => {
    if (reviewText === null) return null;
    const grid = parseClipboardGrid(reviewText);
    const proposals = proposeMeasures(grid, measures, themes);
    const acceptedMeasures = proposals.filter(p => accepted.includes(p.header)).map(p => p.measure);
    const built = planPaste({
      grid, ideas, measures, themes, tags,
      anchorRow: anchor.row, anchorCol: anchor.col,
      acceptedMeasures,
    });
    return { ...built, proposedMeasures: proposals };
  }, [reviewText, accepted, ideas, measures, themes, tags, anchor]);

  const openReview = useCallback((text: string) => {
    setAccepted([]);
    setReviewText(text);
  }, []);

  const closeReview = useCallback(() => {
    setReviewText(null);
    setAccepted([]);
  }, []);

  // Paste anywhere on this tab lands in the grid, anchored on the last cell
  // touched. Pasting into a real text field is left alone.
  useEffect(() => {
    const onDocPaste = (e: ClipboardEvent) => {
      if (reviewText !== null || pasteBoxOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const text = e.clipboardData?.getData('text') ?? '';
      if (!text.trim()) return;
      e.preventDefault();
      openReview(text);
    };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, [openReview, reviewText, pasteBoxOpen]);

  const confirmPlan = () => {
    if (!plan) return;
    const next = applyPaste(plan, ideas, measures, themes, tags);
    const rows = plan.newIdeas.length;
    const cells = plan.updates.reduce((n, u) => n + u.changes.length, 0);
    onApplyPaste(next, `paste of ${rows} new ${rows === 1 ? 'idea' : 'ideas'} and ${cells} ${cells === 1 ? 'change' : 'changes'}`);
    closeReview();
    setPasteBoxOpen(false);
    setPasteBoxText('');
  };

  const handleCSVExport = () => downloadCSV(exportCSV(ideas, measures, themes, tags), 'ballast.csv');
  const handleTemplate = () => downloadCSV(templateCSV(measures, themes), 'ballast-template.csv');

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const sizeError = checkFileSize(file);
    if (sizeError) { setImportErrors([sizeError]); return; }
    const reader = new FileReader();
    reader.onerror = () => setImportErrors(['That file could not be read.']);
    reader.onload = ev => {
      const text = typeof ev.target?.result === 'string' ? ev.target.result : '';
      setPendingImport(parseCSV(text, measures, themes, tags));
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    setImportErrors(pendingImport.errors);
    if (pendingImport.ideas.length > 0) {
      onImport(pendingImport.ideas, pendingImport.newMeasureNames, pendingImport.themes, pendingImport.tags, pendingImport.newMeasures);
    }
    setPendingImport(null);
  };

  const handleMDExport = async () => {
    await copyToClipboard(exportMarkdown(ideas, measures));
    setMdCopied(true);
    setTimeout(() => setMdCopied(false), 2000);
  };

  const navigate = (row: number, col: number, dRow: number, dCol: number) => {
    let newRow = row + dRow;
    let newCol = col + dCol;
    if (newCol >= measures.length) { newRow++; newCol = 0; }
    if (newCol < 0) { newRow--; newCol = measures.length - 1; }
    newRow = Math.max(0, Math.min(displayedIdeas.length - 1, newRow));
    newCol = Math.max(0, Math.min(measures.length - 1, newCol));
    setEditTarget({ row: newRow, col: newCol });
    setAnchor({ row: newRow, col: newCol });
  };

  const newIdea = () => onAddIdea({
    id: makeId('i'), name: 'New idea', description: '', comments: '',
    values: Object.fromEntries(measures.map(m => [m.id, Math.round((m.min + m.max) / 2)])),
    tagsByTheme: {}, priority: 'not-planned',
  });

  const dialogs = (
    <>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={handleCSVImport} />

      {plan && (
        <PastePreview
          plan={plan}
          source="paste"
          acceptedHeaders={accepted}
          onToggleProposed={header =>
            setAccepted(prev => prev.includes(header) ? prev.filter(h => h !== header) : [...prev, header])}
          onConfirm={confirmPlan}
          onCancel={() => {
            closeReview();
            // Send them back to the box with their text intact, so a rejected
            // paste is a correction rather than a re-copy.
            if (pasteBoxText.trim()) setPasteBoxOpen(true);
          }}
        />
      )}

      {pasteBoxOpen && (
        <Modal
          title="Paste from a spreadsheet"
          width={620}
          onClose={() => { setPasteBoxOpen(false); setPasteBoxText(''); }}
          footer={
            <>
              <Button onClick={() => { setPasteBoxOpen(false); setPasteBoxText(''); }}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!pasteBoxText.trim()}
                onClick={() => { openReview(pasteBoxText); setPasteBoxOpen(false); }}
              >
                Continue
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 'var(--s-3)' }}>
            <p style={{ margin: 0 }}>
              Select the cells in Excel, Google Sheets or Numbers, copy them, and paste into the box below.
              Include the header row and the columns are matched by name — including columns for measures that
              do not exist yet.
            </p>
            <textarea
              className="textarea"
              rows={10}
              autoFocus
              placeholder={`name\tPriority\t${measures[0]?.name ?? 'Value'}\nSelf-serve onboarding\tnow\t8`}
              value={pasteBoxText}
              onChange={e => setPasteBoxText(e.target.value)}
            />
            <p className="subtle" style={{ margin: 0 }}>
              Nothing is applied until you have seen a summary of what will change. Your data never leaves this browser.
            </p>
          </div>
        </Modal>
      )}

      {pendingImport && (
        <Modal
          title="Import this file?"
          onClose={() => setPendingImport(null)}
          footer={
            <>
              <Button onClick={() => setPendingImport(null)}>Cancel</Button>
              <Button variant="primary" disabled={pendingImport.ideas.length === 0} onClick={confirmImport}>
                Replace with {pendingImport.ideas.length} ideas
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 'var(--s-3)' }}>
            <Notice tone="warn" title="This replaces the whole table">
              <span className="notice__body">
                The {ideas.length} ideas currently in the table are cleared and the file's {pendingImport.ideas.length} take
                their place. To merge into what is already here instead, use <strong>Paste from spreadsheet</strong>.
              </span>
            </Notice>
            {pendingImport.newMeasureNames.length > 0 && (
              <div className="muted">New measures that will be created: <strong>{pendingImport.newMeasureNames.join(', ')}</strong></div>
            )}
            {pendingImport.errors.length > 0 && (
              <Notice tone="danger" title={`${pendingImport.errors.length} problems in the file`}>
                <div className="stack" style={{ gap: 2 }}>
                  {pendingImport.errors.slice(0, 6).map((e, i) => <div key={i}>{e}</div>)}
                  {pendingImport.errors.length > 6 && <div>…and {pendingImport.errors.length - 6} more</div>}
                </div>
              </Notice>
            )}
          </div>
        </Modal>
      )}
    </>
  );

  if (ideas.length === 0) {
    return (
      <div className="page">
        {importErrors.length > 0 && (
          <Notice tone="danger" title={`Import issues (${importErrors.length})`} onDismiss={() => setImportErrors([])}>
            {importErrors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
          </Notice>
        )}
        <div className="card">
          <div className="card__body stack" style={{ alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-10) var(--s-4)', textAlign: 'center' }}>
            <p className="eyebrow" style={{ margin: 0 }}>Nothing here yet</p>
            <h2 className="abstract" style={{ maxWidth: '32ch' }}>Bring in what you are weighing up.</h2>
            <p className="muted" style={{ maxWidth: '46ch', margin: 0 }}>
              Paste a block of cells straight from a spreadsheet, start from the template, or load the sample portfolio
              to see how the whole thing works.
            </p>
            <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="primary" size="lg" onClick={() => setPasteBoxOpen(true)}>Paste from spreadsheet</Button>
              <Button size="lg" onClick={handleTemplate}>Download template</Button>
              <Button size="lg" onClick={onLoadSample}>Load sample</Button>
              <Button size="lg" onClick={newIdea}>Add an idea</Button>
            </div>
          </div>
        </div>
        {dialogs}
      </div>
    );
  }

  return (
    <div className="page">
      {importErrors.length > 0 && (
        <Notice tone="danger" title={`Import issues (${importErrors.length})`} onDismiss={() => setImportErrors([])}>
          <div className="stack" style={{ gap: 2 }}>
            {importErrors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
            {importErrors.length > 5 && <div>…and {importErrors.length - 5} more</div>}
          </div>
        </Notice>
      )}

      <div className="page-head">
        <h2 className="page-title">Data</h2>
        <p className="page-sub">
          Tap any cell to edit. Copy cells from a spreadsheet and paste anywhere on this tab — you will see exactly what
          changes before it is applied. A dot marks anything edited since {baselineLabel}.
        </p>
      </div>

      <Toolbar>
        <ToolbarGroup>
          <Button variant="primary" onClick={() => setPasteBoxOpen(true)}>Paste from spreadsheet</Button>
          <Button onClick={handleTemplate}>Template</Button>
        </ToolbarGroup>
        <div className="toolbar__divider" />
        <ToolbarGroup>
          <Button onClick={newIdea}>Add idea</Button>
          <Button onClick={onUndo} disabled={!canUndo} title={undoLabel ? `Undo ${undoLabel}` : 'Nothing to undo'}>Undo</Button>
          {hasShortlisted && (
            <Chip pressed={shortlistFilter} onClick={() => onShortlistFilterChange(!shortlistFilter)}>
              {shortlistFilter ? '★ Shortlisted only' : '☆ Shortlisted only'}
            </Chip>
          )}
        </ToolbarGroup>
        <div className="toolbar__spacer" />
        <ToolbarGroup label="Export">
          <Button onClick={handleCSVExport}>CSV</Button>
          <Button onClick={handleMDExport}>{mdCopied ? '✓ Copied' : 'Markdown'}</Button>
          <Button onClick={() => fileRef.current?.click()}>Import…</Button>
          <Button onClick={onStartEmpty}>Clear</Button>
        </ToolbarGroup>
      </Toolbar>

      <div className="card card__body--flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 34 }} title="Shortlist">★</th>
                <th style={{ width: 34 }}><span className="visually-hidden">Open</span></th>
                <th className="col-name">Name</th>
                <th style={{ minWidth: 124 }}>Priority</th>
                <th>Description</th>
                {measures.map(m => (
                  <th key={m.id} style={{ textAlign: 'center' }}>
                    <MeasureTip measure={m} />
                    <span className="th-note">
                      {m.type === 'directional'
                        ? (m.goodEnd === 'high' ? `${m.min}–${m.max} ↑` : `${m.min}–${m.max} ↓`)
                        : `${m.min}–${m.max} ↔`}
                    </span>
                  </th>
                ))}
                <th>Comments</th>
                {themes.map(t => <th key={t.id} style={{ minWidth: 120 }}>{t.name}</th>)}
                <th><span className="visually-hidden">Delete</span></th>
              </tr>
            </thead>
            <tbody>
              {displayedIdeas.map((idea, rowIdx) => (
                <tr key={idea.id} className={idea.shortlisted ? 'row--starred' : undefined}>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className={`star${idea.shortlisted ? ' star--on' : ''}`}
                      onClick={() => onUpdateIdea({ ...idea, shortlisted: !idea.shortlisted }, `shortlist ${idea.name}`)}
                      aria-pressed={!!idea.shortlisted}
                      aria-label={idea.shortlisted ? `Remove ${idea.name} from shortlist` : `Add ${idea.name} to shortlist`}
                    >
                      {idea.shortlisted ? '★' : '☆'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="open-link" onClick={() => onOpenModal(idea)} aria-label={`Open ${idea.name}`}>↗</button>
                  </td>
                  <td className="col-name">
                    <TextCell value={idea.name} onSave={name => onUpdateIdea({ ...idea, name }, 'rename idea')} placeholder="Idea name" />
                  </td>
                  <td>
                    <select
                      className="select"
                      style={{
                        minHeight: 30, fontSize: 'var(--t-xs)', fontWeight: 600,
                        color: PRIORITY_OPTIONS.find(o => o.value === (idea.priority ?? 'not-planned'))?.color,
                      }}
                      value={idea.priority ?? 'not-planned'}
                      onChange={e => onUpdateIdea({ ...idea, priority: e.target.value as Priority }, `set ${idea.name} priority`)}
                      aria-label={`Priority for ${idea.name}`}
                    >
                      {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <TextCell value={idea.description} onSave={description => onUpdateIdea({ ...idea, description }, 'edit description')} placeholder="Description" long />
                  </td>
                  {measures.map((m, colIdx) => {
                    const current = idea.values[m.id] ?? m.min;
                    const was = baselineValue(idea.id, m.id);
                    return (
                      <td key={m.id} className="td--num">
                        <EditableCell
                          value={current}
                          min={m.min}
                          max={m.max}
                          movedFrom={was !== undefined && was !== current ? was : undefined}
                          baselineLabel={baselineLabel}
                          onSave={v => onUpdateIdea(
                            { ...idea, values: { ...idea.values, [m.id]: clampToRange(v, m.min, m.max) } },
                            `edit ${m.name} on ${idea.name}`,
                          )}
                          autoEdit={editTarget?.row === rowIdx && editTarget?.col === colIdx}
                          onClearAutoEdit={() => setEditTarget(null)}
                          onFocusCell={() => setAnchor({ row: rowIdx, col: colIdx })}
                          onTabNext={() => navigate(rowIdx, colIdx, 0, 1)}
                          onTabPrev={() => navigate(rowIdx, colIdx, 0, -1)}
                          onEnterNext={() => navigate(rowIdx, colIdx, 1, 0)}
                          onEnterPrev={() => navigate(rowIdx, colIdx, -1, 0)}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <TextCell value={idea.comments} onSave={comments => onUpdateIdea({ ...idea, comments }, 'edit comment')} placeholder="Why these numbers…" long />
                  </td>
                  {themes.map(theme => (
                    <td key={theme.id}>
                      <TagCell
                        idea={idea}
                        theme={theme}
                        tags={tags}
                        onSave={tagId => onUpdateIdea(
                          { ...idea, tagsByTheme: { ...(idea.tagsByTheme ?? {}), [theme.id]: tagId } },
                          `set ${theme.name}`,
                        )}
                      />
                    </td>
                  ))}
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteIdea(idea.id)} aria-label={`Delete ${idea.name}`}>×</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="subtle" style={{ margin: 0 }}>
        Tab and Shift+Tab move across measure columns; Enter and Shift+Enter move down and up. Cmd or Ctrl+Z undoes the
        last change, and a whole paste undoes in one step. Everything stays in this browser — export a CSV to keep a copy.
      </p>

      {dialogs}
    </div>
  );
}
