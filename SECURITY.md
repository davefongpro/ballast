# Security

## The short version

Ballast has no server, no database, no accounts and no secrets. Everything runs in
the visitor's browser, and their work is stored only there. That removes most of
the usual web attack surface — there is nothing to log into and nothing held on
anyone else's machine to steal.

What remains is worth taking seriously.

## What we actively defend against

**Spreadsheet formula injection.** A cell beginning `=`, `+`, `-`, `@`, or
whitespace is executed as a formula when the file is opened in Excel, LibreOffice
or Google Sheets. Every cell Ballast exports — CSV and Markdown alike — is
neutralised first, and there are tests holding that in place.

**Malformed or oversized input.** Imports and pastes are bounded by file size, row
count, column count and cell length, and report a stated reason when a limit is
crossed rather than freezing the page.

**Untrusted stored state.** Work saved in the browser is versioned and validated
when it is read back. Anything that fails validation is discarded with a message
rather than fed into the application.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's private reporting: go to the
[Security tab](https://github.com/davefongpro/ballast/security) and choose
**Report a vulnerability**. That opens a private channel with the maintainer.

Expect an acknowledgement within a few days. This is a personal project, not a
funded one, so there is no bounty and no formal response-time guarantee — but a
real report will get a real answer, and credit in the changelog if you want it.

## Out of scope

- Anything requiring an attacker to already control the visitor's browser or device.
- The absence of authentication. There is nothing to authenticate; that is the design.
- Denial of service against your own browser tab by pasting something enormous.
  Bounded and reported, not a vulnerability.
