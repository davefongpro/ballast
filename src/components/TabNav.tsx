import type { ReactElement } from 'react';

export type Tab = 'map' | 'profiles' | 'data' | 'measures';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

/* Four marks, drawn rather than iconographic: a plotted point, a profile
   outline, a grid, and a scale. They carry the tab bar on mobile, where the
   labels are small. */
const GLYPHS: Record<Tab, ReactElement> = {
  map: (
    <svg viewBox="0 0 16 16" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2 14V2M2 14h12" strokeLinecap="round" />
      <circle cx="6" cy="10" r="1.6" /><circle cx="10.5" cy="5.5" r="2.2" />
    </svg>
  ),
  profiles: (
    <svg viewBox="0 0 16 16" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M8 1.5 14 6l-2.3 7.5H4.3L2 6z" strokeLinejoin="round" />
      <path d="M8 5.2 11.4 7l-1.3 4.2H5.9L4.6 7z" strokeLinejoin="round" opacity="0.55" />
    </svg>
  ),
  data: (
    <svg viewBox="0 0 16 16" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.4" />
      <path d="M1.8 6.4h12.4M6.4 6.4v6.8" />
    </svg>
  ),
  measures: (
    <svg viewBox="0 0 16 16" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="1.5" y="5" width="13" height="6" rx="1.2" />
      <path d="M4.6 5v2.4M8 5v3.4M11.4 5v2.4" strokeLinecap="round" />
    </svg>
  ),
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'data', label: 'Data' },
  { id: 'measures', label: 'Measures' },
];

export function TabNav({ active, onChange }: Props) {
  return (
    <nav className="tabs" aria-label="Views">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          <span className="tab__glyph">{GLYPHS[tab.id]}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
