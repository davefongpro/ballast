import type { Theme, Tag, Priority } from '../types';
import { Button, Chip, Toolbar, ToolbarGroup } from './ui';

const PRIORITY_CHIPS: { value: Priority; label: string; color: string }[] = [
  { value: 'now', label: 'Now', color: 'var(--c-now)' },
  { value: 'next', label: 'Next', color: 'var(--c-next)' },
  { value: 'later', label: 'Later', color: 'var(--c-later)' },
  { value: 'not-planned', label: 'Not planned', color: 'var(--c-not-planned)' },
];

/**
 * The filter controls shared by Map and Profiles. One component so the two views
 * cannot drift apart — they filter the same set and should look and behave
 * identically doing it.
 */
export function FilterBar({
  themes, tags, filterState, onFilterChange,
  colorByThemeId, onColorByChange,
  priorityFilter, onPriorityFilterToggle,
  hasShortlisted, shortlistFilter, onShortlistFilterChange,
}: {
  themes: Theme[];
  tags: Tag[];
  filterState: Record<string, string>;
  onFilterChange: (next: Record<string, string>) => void;
  colorByThemeId: string | null;
  onColorByChange: (id: string | null) => void;
  priorityFilter: Priority[];
  onPriorityFilterToggle: (p: Priority) => void;
  hasShortlisted: boolean;
  shortlistFilter: boolean;
  onShortlistFilterChange: (v: boolean) => void;
}) {
  const activeFilters = Object.values(filterState).filter(Boolean);

  return (
    <Toolbar>
      <ToolbarGroup label="Priority">
        {PRIORITY_CHIPS.map(chip => (
          <Chip
            key={chip.value}
            dotColor={chip.color}
            pressed={priorityFilter.includes(chip.value)}
            onClick={() => onPriorityFilterToggle(chip.value)}
          >
            {chip.label}
          </Chip>
        ))}
      </ToolbarGroup>

      {themes.length > 0 && (
        <>
          <div className="toolbar__divider" />
          <ToolbarGroup label="Filter">
            {themes.map(theme => (
              <select
                key={theme.id}
                className="select"
                style={{ maxWidth: 170 }}
                value={filterState[theme.id] ?? ''}
                onChange={e => onFilterChange({ ...filterState, [theme.id]: e.target.value })}
                aria-label={`Filter by ${theme.name}`}
              >
                <option value="">All {theme.name}</option>
                {tags.filter(t => t.themeId === theme.id).map(tag => (
                  <option key={tag.id} value={tag.id}>{tag.label}</option>
                ))}
              </select>
            ))}
            {activeFilters.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => onFilterChange({})}>Clear</Button>
            )}
          </ToolbarGroup>

          <div className="toolbar__divider" />
          <ToolbarGroup label="Colour by">
            <select
              className="select"
              style={{ maxWidth: 170 }}
              value={colorByThemeId ?? ''}
              onChange={e => onColorByChange(e.target.value || null)}
              aria-label="Colour points by"
            >
              <option value="">Nothing</option>
              <option value="__priority__">Priority</option>
              {themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </ToolbarGroup>
        </>
      )}

      {hasShortlisted && (
        <>
          <div className="toolbar__spacer" />
          <Chip pressed={shortlistFilter} onClick={() => onShortlistFilterChange(!shortlistFilter)}>
            {shortlistFilter ? '★ Shortlisted only' : '☆ Shortlisted only'}
          </Chip>
        </>
      )}
    </Toolbar>
  );
}
