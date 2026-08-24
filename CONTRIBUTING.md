# Contributing

Issues and pull requests are welcome. A few things worth knowing before you spend time.

## What this project is trying to be

A tool that shows tradeoffs and portfolio balance. It is deliberately **not** a
decision system: no capacity model, no weighted scoring, no recommendation engine,
no accounts, no server. Proposals that move it toward those are likely to be
declined — not because they are bad ideas, but because the small claim is the
point. See "What this is not" in the README.

## Ground rules that hold everywhere in the code

**No hardcoded colour, size or spacing values in components.** Every visual value
resolves through `src/styles/tokens.css`, via a class in `src/styles/base.css` or a
primitive in `src/components/ui/`. Two exceptions are marked in the code, both
because SVG fills cannot read a CSS variable. `design.md` is the reference.

**Every cell leaving the app passes through `sanitizeCell`.** A spreadsheet runs a
cell beginning `=`, `+`, `-` or `@` as a formula when the file is opened, so any new
export format must neutralise its output at the serialisation boundary.

**Nothing is dropped silently.** If a paste or import cannot use something, the
preview says which cell and why. An empty result and a rejected result must never
look the same.

**Nothing leaves the browser.** No analytics call, no error reporter and no
integration may transmit the contents of a user's work. Page-view counting is the
only thing that talks to a network, and the privacy page describes it exactly.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # type-check and production build
npm run lint
```

## Pull requests

- One change per pull request, described in plain words: what is different now,
  and why.
- Tests for anything in `src/utils/` — that is where a silent correctness bug
  would hide.
- `npm test` and `npm run build` must pass.
- If you change how something behaves, update the README or `design.md` in the
  same pull request.

## Reporting something

Bugs and ideas: [open an issue](https://github.com/davefongpro/ballast/issues).
Security: see [SECURITY.md](SECURITY.md).
