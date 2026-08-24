# Changelog

## v1.0.0 — 2026-08-23

First public release.

**What it does.** Plots ideas against measures — including tradeoff measures, which
have two named ends and no better one — and writes out in plain English which way the
set leans.

- **The abstract.** A written reading of every tradeoff measure across the visible
  set, opened from the density overlay on the Profiles tab. The finding this tool
  exists to produce.
- **Paste from a spreadsheet.** Copy a block from Excel, Sheets or Numbers and paste
  it anywhere on the Data tab. Columns are matched by header name, rows are matched to
  existing ideas, and a numeric column with no measure defined is offered as a measure
  to create. Nothing is applied until a preview names what will be added, changed and
  rejected — with a reason per rejected cell.
- **Measure benchmarks.** Every measure carries a line saying what its numbers mean,
  readable on hover, tap or keyboard focus wherever the measure's name appears.
- **Undo.** Forty steps. One paste is one step, however many cells it touched.
- **Changed-value markers.** A value edited since the file was loaded is marked, with
  its previous number and date in the idea's detail view.
- **Local persistence.** Work survives a reload. Nothing is uploaded.

**Safety.** Every exported cell is neutralised against spreadsheet formula injection.
Imports are bounded by size, rows, columns and cell length, and report a stated reason
when a limit is crossed. Stored state is versioned and validated when read back.

**Design.** One dark world, mobile first — see `design.md` for the palette with its
measured contrast ratios, the type roles, and the reasoning behind each choice.
