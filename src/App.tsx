import { useCallback, useEffect, useState } from 'react';
import type { Idea, Measure, Theme, Tag, ChartConfig, Priority } from './types';
import { sampleIdeas, sampleMeasures, sampleThemes, sampleTags } from './data/sampleData';
import { TabNav } from './components/TabNav';
import type { Tab } from './components/TabNav';
import { MapTab } from './components/tabs/MapTab';
import { ProfilesTab } from './components/tabs/ProfilesTab';
import { DataTab } from './components/tabs/DataTab';
import { MeasuresTab } from './components/tabs/MeasuresTab';
import { DrillDown } from './components/DrillDown';
import { Button, Modal, Notice } from './components/ui';
import { AppFooter } from './components/AppFooter';
import { loadState, saveState } from './utils/persistence';
import { useDoc } from './state/useDoc';
import type { Doc } from './state/useDoc';

/**
 * Priority colours, mirrored from `--c-now` … `--c-not-planned` in tokens.css.
 * Charts render through SVG fills, which cannot read a CSS variable, so these
 * live in two places by necessity. Change one, change the other.
 */
export const PRIORITY_COLORS: Record<Priority, string> = {
  'now': '#82B1FF',
  'next': '#6E90D6',
  'later': '#7C93AD',
  'not-planned': '#7A828E',
};

const sampleDoc = (): Doc => ({
  ideas: structuredClone(sampleIdeas),
  measures: structuredClone(sampleMeasures),
  themes: structuredClone(sampleThemes),
  tags: structuredClone(sampleTags),
});

export default function App() {
  // The last session in this browser, read once before first paint so there is no
  // flash of sample data.
  const [restore] = useState(loadState);
  const saved = restore.status === 'ok' ? restore.state : null;

  const {
    doc, commit, reset, undo, canUndo, undoLabel, baselineAt, baselineValue,
  } = useDoc(
    saved ? { ideas: saved.ideas, measures: saved.measures, themes: saved.themes, tags: saved.tags } : sampleDoc(),
    saved ? new Date(saved.savedAt) : new Date(),
  );
  const { ideas, measures, themes, tags } = doc;

  const [tab, setTab] = useState<Tab>('map');
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    xMeasureId: 'm-effort',
    yMeasureId: 'm-impact',
    sizeMeasureId: 'm-confidence',
  });
  const [selectedMeasureIds, setSelectedMeasureIds] = useState<string[]>(
    () => (saved?.measures ?? sampleMeasures).filter(m => m.type === 'bipolar').map(m => m.id),
  );
  const [drillIdea, setDrillIdea] = useState<Idea | null>(null);
  const [drillExcludeIds, setDrillExcludeIds] = useState<string[]>([]);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [shortlistFilter, setShortlistFilter] = useState(false);
  const [colorByThemeId, setColorByThemeId] = useState<string | null>((saved?.themes ?? sampleThemes)[0]?.id ?? null);
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const [storageNotice, setStorageNotice] = useState<string | null>(
    restore.status === 'discarded'
      ? `Your last session could not be restored — ${restore.reason}. Starting from the sample data.`
      : null,
  );

  // Everything stays in this browser. Saved after every change.
  useEffect(() => { saveState({ ideas, measures, themes, tags }); }, [ideas, measures, themes, tags]);

  // Keep the chart selections valid when measures change.
  useEffect(() => {
    const ids = measures.map(m => m.id);
    setChartConfig(prev => ({
      xMeasureId: ids.includes(prev.xMeasureId) ? prev.xMeasureId : (ids[0] ?? ''),
      yMeasureId: ids.includes(prev.yMeasureId) ? prev.yMeasureId : (ids[1] ?? ''),
      sizeMeasureId: prev.sizeMeasureId && ids.includes(prev.sizeMeasureId) ? prev.sizeMeasureId : undefined,
    }));
    setSelectedMeasureIds(prev => prev.filter(id => ids.includes(id)));
  }, [measures]);

  // Cmd/Ctrl+Z anywhere that isn't a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA'].includes(t.tagName)) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  /* ---------------- ideas ---------------- */

  const handleUpdateIdea = useCallback((updated: Idea, label = `edit ${updated.name}`) => {
    commit(label, prev => ({ ...prev, ideas: prev.ideas.map(i => i.id === updated.id ? updated : i) }));
    setDrillIdea(prev => prev?.id === updated.id ? updated : prev);
  }, [commit]);

  const handleDeleteIdea = useCallback((id: string) => {
    commit('delete idea', prev => ({ ...prev, ideas: prev.ideas.filter(i => i.id !== id) }));
  }, [commit]);

  const handleAddIdea = useCallback((idea: Idea) => {
    commit('add idea', prev => ({ ...prev, ideas: [...prev.ideas, idea] }));
  }, [commit]);

  const handleImport = useCallback((imported: Idea[], _n: string[], newThemes: Theme[], newTags: Tag[], newMeasures: Measure[]) => {
    reset({ ideas: imported, themes: newThemes, tags: newTags, measures: [...measures, ...newMeasures] });
  }, [reset, measures]);

  /** One paste is one undoable step, however many cells it touched. */
  const handleApplyPaste = useCallback((next: Doc, label: string) => {
    commit(label, next);
  }, [commit]);

  const handleLoadSample = useCallback(() => {
    reset(sampleDoc());
    setChartConfig({ xMeasureId: 'm-effort', yMeasureId: 'm-impact', sizeMeasureId: 'm-confidence' });
    setSelectedMeasureIds(sampleMeasures.filter(m => m.type === 'bipolar').map(m => m.id));
    setShortlistFilter(false);
    setColorByThemeId(sampleThemes[0]?.id ?? null);
    setPriorityFilter([]);
  }, [reset]);

  const handleStartEmpty = useCallback(() => {
    reset({ ideas: [], measures, themes, tags });
  }, [reset, measures, themes, tags]);

  /* ---------------- measures ---------------- */

  const handleAddMeasure = useCallback((m: Measure) => {
    commit(`add measure ${m.name}`, prev => ({ ...prev, measures: [...prev.measures, m] }));
  }, [commit]);

  const handleUpdateMeasure = useCallback((updated: Measure) => {
    commit(`edit measure ${updated.name}`, prev => ({
      ...prev,
      measures: prev.measures.map(m => m.id === updated.id ? updated : m),
      ideas: prev.ideas.map(idea => {
        const val = idea.values[updated.id];
        if (val === undefined) return idea;
        const clamped = Math.round(Math.max(updated.min, Math.min(updated.max, val)));
        return clamped === val ? idea : { ...idea, values: { ...idea.values, [updated.id]: clamped } };
      }),
    }));
  }, [commit]);

  const handleDeleteMeasure = useCallback((id: string) => {
    commit('delete measure', prev => ({ ...prev, measures: prev.measures.filter(m => m.id !== id) }));
  }, [commit]);

  /* ---------------- themes and tags ---------------- */

  const handleAddTheme = useCallback((t: Theme) => {
    commit(`add ${t.name}`, prev => ({ ...prev, themes: [...prev.themes, t] }));
  }, [commit]);

  const handleUpdateTheme = useCallback((t: Theme) => {
    commit(`edit ${t.name}`, prev => ({ ...prev, themes: prev.themes.map(x => x.id === t.id ? t : x) }));
  }, [commit]);

  const handleDeleteTheme = useCallback((id: string) => {
    commit('delete category', prev => ({
      ...prev,
      themes: prev.themes.filter(t => t.id !== id),
      tags: prev.tags.filter(t => t.themeId !== id),
      ideas: prev.ideas.map(idea => {
        const next = { ...(idea.tagsByTheme ?? {}) };
        delete next[id];
        return { ...idea, tagsByTheme: next };
      }),
    }));
    setColorByThemeId(prev => prev === id ? null : prev);
  }, [commit]);

  const handleAddTag = useCallback((t: Tag) => {
    commit(`add ${t.label}`, prev => ({ ...prev, tags: [...prev.tags, t] }));
  }, [commit]);

  const handleUpdateTag = useCallback((t: Tag) => {
    commit(`edit ${t.label}`, prev => ({ ...prev, tags: prev.tags.map(x => x.id === t.id ? t : x) }));
  }, [commit]);

  const handleDeleteTag = useCallback((id: string) => {
    commit('delete label', prev => {
      const tag = prev.tags.find(t => t.id === id);
      return {
        ...prev,
        tags: prev.tags.filter(t => t.id !== id),
        ideas: tag
          ? prev.ideas.map(idea => idea.tagsByTheme?.[tag.themeId] === id
              ? { ...idea, tagsByTheme: { ...idea.tagsByTheme, [tag.themeId]: null } }
              : idea)
          : prev.ideas,
      };
    });
  }, [commit]);

  /* ---------------- view state ---------------- */

  const handlePriorityFilterToggle = useCallback((p: Priority) => {
    setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }, []);

  const getIdeaColor = useCallback((idea: Idea, tagList: Tag[]): string | undefined => {
    if (colorByThemeId === '__priority__') return PRIORITY_COLORS[idea.priority];
    if (colorByThemeId) {
      const tagId = idea.tagsByTheme?.[colorByThemeId];
      if (tagId) return tagList.find(t => t.id === tagId)?.color;
    }
    return undefined;
  }, [colorByThemeId]);

  const handleSelectMeasure = useCallback((id: string, checked: boolean) => {
    setSelectedMeasureIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  }, []);

  const handleDrill = useCallback((idea: Idea, excludeIds: string[]) => {
    setDrillIdea(idea);
    setDrillExcludeIds(excludeIds);
  }, []);

  const handleOpenModal = useCallback((idea: Idea) => {
    setDrillIdea(idea);
    setDrillExcludeIds([]);
  }, []);

  const drillMeasureIds = selectedMeasureIds.length >= 2
    ? selectedMeasureIds
    : measures.map(m => m.id).filter(id => !drillExcludeIds.includes(id));

  const handleRevert = useCallback(() => {
    reset(sampleDoc());
    setShortlistFilter(false);
    setPriorityFilter([]);
    setShowRevertConfirm(false);
  }, [reset]);

  const baselineLabel = baselineAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">Ballast</span>
          <span className="app-tagline">Not every tradeoff has a winner</span>
        </div>
        <div className="app-header-actions">
          <span className="app-privacy" title="No account, no server, no upload">Stays in your browser</span>
          <Button size="sm" onClick={undo} disabled={!canUndo} title={undoLabel ? `Undo ${undoLabel}` : 'Nothing to undo'}>
            Undo
          </Button>
          <Button size="sm" onClick={() => setShowRevertConfirm(true)}>Reset</Button>
        </div>
      </header>

      <TabNav active={tab} onChange={setTab} />

      {storageNotice && (
        <div style={{ padding: 'var(--s-4) var(--s-4) 0' }}>
          <Notice tone="warn" onDismiss={() => setStorageNotice(null)}>{storageNotice}</Notice>
        </div>
      )}

      <main className="app-main">
        {tab === 'map' && (
          <MapTab
            ideas={ideas}
            measures={measures}
            themes={themes}
            tags={tags}
            xId={chartConfig.xMeasureId}
            yId={chartConfig.yMeasureId}
            sizeId={chartConfig.sizeMeasureId}
            onXChange={id => setChartConfig(prev => ({ ...prev, xMeasureId: id }))}
            onYChange={id => setChartConfig(prev => ({ ...prev, yMeasureId: id }))}
            onSizeChange={id => setChartConfig(prev => ({ ...prev, sizeMeasureId: id }))}
            onDrill={handleDrill}
            onUpdateIdea={idea => handleUpdateIdea(idea, `drag ${idea.name}`)}
            shortlistFilter={shortlistFilter}
            onShortlistFilterChange={setShortlistFilter}
            colorByThemeId={colorByThemeId}
            onColorByChange={setColorByThemeId}
            priorityFilter={priorityFilter}
            onPriorityFilterToggle={handlePriorityFilterToggle}
            getIdeaColor={getIdeaColor}
          />
        )}

        {tab === 'profiles' && (
          <ProfilesTab
            ideas={ideas}
            measures={measures}
            themes={themes}
            tags={tags}
            selectedMeasureIds={selectedMeasureIds}
            onSelectMeasure={handleSelectMeasure}
            onDrill={handleDrill}
            onUpdateIdea={idea => handleUpdateIdea(idea, `drag ${idea.name}`)}
            shortlistFilter={shortlistFilter}
            onShortlistFilterChange={setShortlistFilter}
            colorByThemeId={colorByThemeId}
            onColorByChange={setColorByThemeId}
            priorityFilter={priorityFilter}
            onPriorityFilterToggle={handlePriorityFilterToggle}
            getIdeaColor={getIdeaColor}
          />
        )}

        {tab === 'data' && (
          <DataTab
            doc={doc}
            onUpdateIdea={handleUpdateIdea}
            onDeleteIdea={handleDeleteIdea}
            onAddIdea={handleAddIdea}
            onImport={handleImport}
            onApplyPaste={handleApplyPaste}
            onLoadSample={handleLoadSample}
            onStartEmpty={handleStartEmpty}
            onOpenModal={handleOpenModal}
            shortlistFilter={shortlistFilter}
            onShortlistFilterChange={setShortlistFilter}
            baselineValue={baselineValue}
            baselineLabel={baselineLabel}
            canUndo={canUndo}
            undoLabel={undoLabel}
            onUndo={undo}
          />
        )}

        {tab === 'measures' && (
          <MeasuresTab
            doc={doc}
            onAdd={handleAddMeasure}
            onUpdate={handleUpdateMeasure}
            onDelete={handleDeleteMeasure}
            onAddTheme={handleAddTheme}
            onUpdateTheme={handleUpdateTheme}
            onDeleteTheme={handleDeleteTheme}
            onAddTag={handleAddTag}
            onUpdateTag={handleUpdateTag}
            onDeleteTag={handleDeleteTag}
            onApplyPaste={handleApplyPaste}
          />
        )}
      </main>

      <AppFooter />

      <DrillDown
        idea={drillIdea}
        measures={measures}
        themes={themes}
        tags={tags}
        drillMeasureIds={drillMeasureIds}
        baselineValue={baselineValue}
        baselineLabel={baselineLabel}
        onClose={() => setDrillIdea(null)}
        onUpdateIdea={handleUpdateIdea}
        onPriorityChange={(idea, priority) => handleUpdateIdea({ ...idea, priority }, `set ${idea.name} to ${priority}`)}
      />

      {showRevertConfirm && (
        <Modal
          title="Reset to the sample portfolio?"
          onClose={() => setShowRevertConfirm(false)}
          footer={
            <>
              <Button onClick={() => setShowRevertConfirm(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleRevert}>Reset everything</Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            Every idea and measure is replaced by the built-in sample portfolio, the undo history is cleared,
            and that becomes the version saved in this browser. Export a CSV first if you want to keep your work.
          </p>
        </Modal>
      )}
    </div>
  );
}
