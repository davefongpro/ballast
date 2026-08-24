# Architecture

A single-page React app with no backend. Everything runs in the browser; the only
network traffic is fonts and page-view counting.

```
index.html → src/main.tsx → src/App.tsx → four tabs
```

## The shape of it

`App.tsx` holds the whole document — ideas, measures, categories and labels — as one
value, and passes slices of it down. That is deliberate: see `state/useDoc.ts`.

Everything else is either a **tab** (a screen), a **component** (a piece of UI), or a
**util** (a pure function with no React in it). The utils are where the real logic
lives and where the tests are, because a silent correctness bug in a parser is far
more expensive than a visual bug in a chart.

## Files

### State

| File | What it does |
|---|---|
| `state/useDoc.ts` | The document as one object, with a 40-step undo stack and a baseline. One object rather than four pieces of state for two reasons: a paste of two hundred cells has to undo as *one* step, and "was 6 on 19 Aug" needs a whole-document snapshot to compare against. |

### Screens

| File | What it does |
|---|---|
| `components/tabs/MapTab.tsx` | Scatter/bubble chart (Recharts). Title, axis pickers, filters, then the chart. Points are draggable. |
| `components/tabs/ProfilesTab.tsx` | Radar profile per idea, a density overlay of all of them, and a by-priority grid. The overlay opens the written abstract. |
| `components/tabs/DataTab.tsx` | The editable table. Paste target, CSV import/export, keyboard navigation. |
| `components/tabs/MeasuresTab.tsx` | Defining measures and their benchmarks; categories and labels; bulk measure paste. |

### Components

| File | What it does |
|---|---|
| `components/ui/index.tsx` | Primitives: Button, Chip, Card, Toolbar, Field, Notice, Modal, Collapsible. Appearance only, no logic. |
| `components/BalanceReadout.tsx` | The abstract. Three forms: bare inside a dialog, compact as a one-line strip, or framed in its own card. |
| `components/MeasureTip.tsx` | A measure's name with its benchmarks beneath. Opens on hover, click/tap **and** keyboard focus — hover alone would put them out of reach on a phone and for keyboard users. |
| `components/PastePreview.tsx` | What a paste will do, before it does it. New ideas, changed values, proposed measures, rejections with reasons. |
| `components/FilterBar.tsx` | The filter controls shared by Map and Profiles, so the two cannot drift apart. |
| `components/DrillDown.tsx` | One idea in full: radar, every value, description, comments, categories. |
| `components/charts/SpiderChart.tsx` | The radar itself. Raw SVG, draggable vertices. |
| `components/charts/AxisLabels.tsx` | The axis labels both radars draw, in one place so the two cannot drift apart. |
| `utils/axisLabels.ts` | How much horizontal room those labels need, and the size below which the pole pair is dropped. |
| `components/AppFooter.tsx` | Attribution, source link, privacy link. |
| `components/TabNav.tsx` | Bottom bar on mobile, top tabs on desktop. Same markup, different placement. |

### Logic — this is where the tests are

| File | What it does |
|---|---|
| `utils/paste.ts` | The paste engine. `parseClipboardGrid` (tab-separated first, quoted CSV as fallback), `planPaste` → a description of what would happen, `proposeMeasures` (numeric columns with no matching measure, offered for creation), `applyPaste` → the next arrays. Pure: it plans nothing until confirmed and mutates nothing ever. |
| `utils/measurePaste.ts` | The same idea for measure definitions. Matches by header name, updates an existing measure rather than duplicating it, refuses a two-ended measure with only one end named. |
| `utils/balance.ts` | `computeBalance` — the abstract. Judges each tradeoff measure's lean **among the ideas that take a side**; counting the neutral ones against it produces sentences that say the opposite of what the data shows. |
| `utils/csvUtils.ts` | CSV import and export, plus the import template. |
| `utils/markdownUtils.ts` | Markdown table export. |
| `utils/sanitize.ts` | Formula-injection neutralisation. A cell starting `= + - @` or whitespace runs as a formula when a file is opened in Excel, so every exported cell passes through here. |
| `utils/limits.ts` | Bounds on imported and pasted input, and `safeExtent` — min/max without an argument spread, which overflows the call stack on a long list. |
| `utils/normalize.ts` | Scaling values onto a shared axis. |
| `utils/ids.ts` | Collision-safe ids. The previous timestamp-based scheme collided within a millisecond, which silently merges two rows in React's reconciler. |
| `utils/persistence.ts` | Local save and restore. Versioned, and validated when read back — stored content is user-supplied, so it is never fed unchecked into state. |
| `utils/tagColors.ts` | The categorical palette, mirrored from the CSS tokens because SVG fills cannot read a CSS variable. |

### Styling

| File | What it does |
|---|---|
| `styles/tokens.css` | Every colour, size, space, radius, shadow and duration in the product. One dark world. |
| `styles/base.css` | The app shell and every component class, mobile-first. |
| `design.md` (repo root) | Why each of those values is what it is, with measured contrast ratios. |

## Rules that hold everywhere

**No hardcoded visual values in components.** Everything resolves through
`tokens.css`. Two exceptions are marked in the code — `PRIORITY_COLORS` in `App.tsx`
and the palette in `utils/tagColors.ts` — because Recharts renders SVG fills that
cannot read a CSS variable.

**Everything leaving the app is sanitised.** Any new export format adds
`sanitizeCell` at its serialisation boundary.

**Nothing is dropped silently.** If a paste can't use a cell, the preview names the
cell and the reason. A measured zero and an unmeasured zero must never look the same.

**Nothing leaves the browser.** No feature may transmit the contents of a user's work.

## Adding something

**A new kind of measure** — `types.ts` for the type, `utils/normalize.ts` if it needs
different axis behaviour, `MeasuresTab.tsx` for the editor, `utils/measurePaste.ts` to
accept it from a paste.

**A new column in the data table** — `types.ts`, then `DataTab.tsx` for the cell, then
`utils/csvUtils.ts` and `utils/paste.ts` so it round-trips.

**A new export format** — a new `utils/<format>Utils.ts`, sanitised at the boundary,
wired to a button in `DataTab.tsx`.

**A new tab** — `TabNav.tsx` for the destination and its glyph, a component under
`components/tabs/`, and a branch in `App.tsx`.
