# Ballast — design system

*Newton's First Labs · 2026-08-23*

The reference for how Ballast looks and behaves. It began as a review of an
earlier visual draft: that draft's reading order and its word *Abstract* were
kept, its palette, typography and several of its component rules were not, for
the reasons recorded at the end.

**Everything here lives in code.** Colour, type, spacing, radius, elevation and
motion are defined once in `src/styles/tokens.css` and used through classes in
`src/styles/base.css` or primitives in `src/components/ui/`. No component
hardcodes a visual value. The two sanctioned exceptions are `PRIORITY_COLORS` in
`App.tsx` and the palette in `src/utils/tagColors.ts`, because SVG fills in
Recharts cannot read a CSS variable — both are marked as mirrors and must be
changed in step with the tokens.

---

## 1. Direction

**An instrument, not a dashboard.** Ballast is a measuring tool used by product
leaders to make an argument in front of other people. It should feel like
something machined: quiet, exact, and confident about what it does not do.

Dark only, and deliberately so. There is no light palette to keep in step, so
every colour is chosen for one ground and tested against it.

## 2. Colour

### Ground and surfaces

Not pure black. `#000` leaves nowhere for a shadow to fall and no room for
surfaces to layer, which is why pure-black interfaces flatten out. The ground is
a deep blue-ink, and four surface steps read as four steps.

| Token | Value | Use |
|---|---|---|
| `--c-sunken` | `#0B0E12` | Inputs, wells, modal footers |
| `--c-ground` | `#0F1216` | The page |
| `--c-surface` | `#171B21` | Cards, header, tab bar |
| `--c-surface-2` | `#1E232B` | Buttons at rest, table headers |
| `--c-surface-3` | `#262C35` | Hover, the empty half of a bar |
| `--c-border` | `#262C35` | Hairlines |
| `--c-border-strong` | `#39414E` | Control outlines |

### Text — measured against `--c-ground`

| Token | Value | Contrast | Use |
|---|---|---|---|
| `--c-text` | `#EDEFF3` | **16.3:1** | Headings, values, findings |
| `--c-text-2` | `#A8B0BC` | **8.6:1** | Body, descriptions, table cells |
| `--c-text-3` | `#858D9A` | **5.3:1** | Labels, hints, meta |

### Accent: brass

`--c-accent` `#E5A64B`, hover `#F2B764`, ink on accent `#17130A`.

Instrument dials and marine fittings. It carries authority without glowing, and
it is deliberately not the saturated cyan that every dark interface now reaches
for. **8.8:1** on the ground as a line or label, and near-black sits on it at
**8.7:1** when it is a button — which is exactly the state a bright accent
usually fails. (The reviewed draft specified white text on cyan: 1.25:1, and on
amber: 2.15:1. Both unreadable.)

### Status — meaning, not ranking

`--c-ok` `#5FBF8C` (8.3:1) · `--c-warn` `#E08A3C` (7.0:1) · `--c-danger`
`#E86A62` (6.0:1), each with a `-soft` fill and a `-line` border.

### Priority — ranking, not meaning

`--c-now` `#82B1FF` (8.7:1) · `--c-next` `#6E90D6` (5.9:1) · `--c-later`
`#7C93AD` (5.9:1) · `--c-not-planned` `#7A828E` (4.8:1).

One hue at four intensities. Priority genuinely *is* ordered, so an intensity
ramp is honest — and unlike green/amber/red it does not imply that "Later" is a
bad outcome. Kept clear of brass so a priority chip is never mistaken for a
button, and separate from the status colours so a "Next" chip and a warning
banner can never look the same.

### Categorical — for charts

`--cat-1` `#6FA8FF` · `--cat-2` `#F2A65A` · `--cat-3` `#59C08D` · `--cat-4`
`#D07CC7` · `--cat-5` `#E0685F` · `--cat-6` `#59BFD0` · `--cat-7` `#BFAE5C` ·
`--cat-8` `#8E92E8`.

Every one clears 5.6:1 on the ground, ordered so neighbours stay separable for
the common forms of colour blindness. Used when colouring by category; the
priority ramp is used when colouring by priority. **The two are alternatives and
never appear at once**, which is why their hues may overlap.

## 3. Typography

Three roles, three families, each doing one job.

| Role | Family | Why |
|---|---|---|
| Findings | **Literata** 400/600 | Drawn for screen reading; its strokes stay solid on a dark ground, where a high-contrast fashion serif shimmers and its hairlines vanish |
| Interface | **IBM Plex Sans** 400/500/600 | Engineered rather than neutral, with a technical heritage that suits the subject |
| Numbers | **IBM Plex Mono** 400/500 | Same family, tabular figures, so columns of scores line up |

Scale: 11 · 12 · 13 · 14 · 15 · 17 · 20 · 24 · 30 px, with line heights 1.2
(tight), 1.35 (snug) and 1.55 (body). `font-variant-numeric: tabular-nums` is set
on `body`, so every digit in the product aligns without being asked to.

## 4. Space, radius, elevation, motion

**Space** is a strict 4px rhythm — 4, 8, 12, 16, 20, 24, 28, 32, 40, 48. No
value outside the scale.

**Radius** 4 (chips, inputs) · 6 (buttons) · 10 (cards) · 14 (modals) · pill.

**Elevation** on a dark ground is carried by the surface step plus a one-pixel
top highlight (`--edge-top`); the shadow is support, not the mechanism. **No
backdrop blur behind content** — over a several-hundred-row table next to live
charts it costs real frames and costs legibility.

**Motion** is 110ms and 170ms on a single easing curve, applied to colour and
background only. `prefers-reduced-motion` sets both durations to zero. Nothing
in this product pulses, flashes or breathes.

**Focus** is one treatment everywhere: a 2px ground-coloured gap and a 2px brass
ring, via `--focus-ring`.

## 5. Layout — mobile first

Every rule starts at the small screen and widens at `min-width: 768px`.

- **Navigation.** A fixed bottom bar on mobile — four destinations, thumb
  reachable, clear of the home indicator. A tab strip under the header on
  desktop. Same four destinations, same markup, only the placement changes. Four
  destinations do not justify a sidebar, and the widest screen is exactly where
  the data table needs its horizontal room.
- **Controls collapse on mobile.** Filters and axis pickers sit inside a
  `Collapsible` that starts closed under 768px and open above it, so a phone
  shows the chart rather than three cards of controls above it.
- **The table keeps its density.** 8px vertical cell padding, horizontal scroll,
  a sticky header, and the **Name column frozen to the left** — without that, a
  15-column table is a wall of numbers with no way to tell which row is which.
- **Modals are sheets on mobile**, rising from the bottom edge with full-width
  buttons, and centred dialogs on desktop.
- Page content is capped at 1520px; running prose at 68 characters.

## 6. Components

`Button` (default / primary / ghost / danger, in sm / md / lg) · `Chip` (with an
optional colour dot, `aria-pressed`) · `Card` (optional head with actions) ·
`Toolbar` + `ToolbarGroup` · `Field` · `Notice` (info / ok / warn / danger) ·
`Modal` (labelled dialog, Escape and backdrop close) · `Collapsible` ·
`MeasureTip` · `BalanceReadout`.

Touch targets are 40px minimum on mobile, tightening to 34px on desktop where
the pointer is precise.

### MeasureTip — the benchmark tooltip

Opens **three ways: hover, click or tap, and keyboard focus.** Hover alone would
put the benchmarks out of reach on a phone and for anyone using a keyboard, and
the benchmarks are the thing that makes one person's scores legible to another.
Click pins it open; Escape or an outside click closes it. It appears wherever a
measure's name does — table headers, axis pickers, the idea detail view — as an
underlined name, or as a round badge where it stands alone.

### Changed-value marker

A 5px brass dot beside any value edited since the file was last loaded, with the
old number and its date in the idea's detail view and in the cell's tooltip. It
is **static**: quiet, present, and never alarming. A table with forty edits would
otherwise have forty things pulsing, which is the opposite of information.

## 7. Reading order

Kept from the reviewed draft, because it is right and it is the product's whole
argument:

> **The finding, then the visual proof, then the granular proof.**

With one correction after the first review: on Profiles the density overlay *is*
the finding, drawn, and **the written abstract opens from it** — click the shape,
or the button beside it. The two are the same reading in two forms, so stacking
one permanently above the other said everything twice.

On Map the order is title, axis pickers, filters, chart: choose what you are
plotting, narrow it, then look. On Data the table is the granular proof and needs
no preamble.

The abstract is set in Literata at `--t-xl` — it is prose, and it is the one
place in the product where the type is allowed to be the loudest thing.

## 8. Writing

Sentences, not labels, wherever there is room. Say what happened and what it
means: *"Visibility leans Internal: 16 of the 16 that take a side, with nothing
at the Customer-facing end."* Errors say what was rejected and why, per cell,
with the row named. No apologies. No exclamation marks. Never an emoji as an
icon or a section marker.

## 8b. Radar axis labels

A radar's labels sit outside its outer ring and the side ones run horizontally
away from it, so **a radar is wider than its ring** — by a label on each side. Both
radars size their SVG to include that, rather than drawing outside the box, so a
row of them cannot overlap.

**Below 220px the pole pair is dropped and only the measure name is drawn.** At 8px
inside a 160px chart the pair was unreadable, and it was what made the labels wide
enough to collide. The full pair still appears on the large overlay and in the
drill-down, where there is room to read it.

A measure can be named anything, so the reserved room is capped at 75% of the chart
and longer text is truncated — an uncapped pad would let one long name push a chart
out of its column, which is the same failure in a new place.

Both rules live in `src/utils/axisLabels.ts` and are drawn by
`src/components/charts/AxisLabels.tsx`; neither radar carries its own copy.

## 9. What was kept from the earlier draft, and what was not

**Kept:** the reading order · the word *Abstract* for the balance readout · three
type roles (serif findings, sans interface, mono numbers) · frozen Name column
with horizontal scroll and a sticky header · 8px cell padding · the tooltip
opening three ways.

**Replaced, and why:**

| Draft | Replaced with | Reason |
|---|---|---|
| White text on cyan and amber buttons | Near-black on brass, 8.7:1 | 1.25:1 and 2.15:1 — the primary button was unreadable in its most important state |
| `#00FFFF` accent | `#E5A64B` brass | Full-saturation cyan on near-black halates, is a known strain trigger, and reads cyberpunk rather than precision instrument |
| Emerald/amber/ruby for both priority and status | An intensity ramp for priority, separate hues for status | A "Next" chip and a warning banner were the same amber; and green-amber-red implies "Later" is bad |
| One "category purple" | Eight contrast-checked chart colours | Colouring points by category is a core feature and one colour cannot do it |
| Glass panels, backdrop blur, pulsing chips, a pulsing dot per changed value | Surface steps, a top highlight, a static marker | Blur over a large table costs frames and legibility; forty pulsing dots is an alarm, not information |
| Sidebar navigation, mobile card-scroll table | Bottom bar on mobile, top tabs on desktop, table keeps its density everywhere | A navigation change is a structural decision, not part of a colour pass; and the table's density is the point |
| `#737373` for change-history text | `#858D9A` | 4.27:1 fails AA, on the smallest text in the product |
| "WCAG AAA" asserted with no numbers | Every ratio measured and printed above | An unverified claim is worse than no claim |

**Missing from the draft and added here:** the full spacing scale, button
variants and sizes, form fields, notice tones, the empty state, all four dialogs,
the balance bar, per-screen reading order, interaction states, and
`prefers-reduced-motion`.
