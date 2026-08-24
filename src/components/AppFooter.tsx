const REPO = 'https://github.com/davefongpro/ballast';

/**
 * The quiet line at the bottom: who made it, where the source is, and what the
 * app does with data. It is the only place the app makes a claim about itself,
 * so it stays short and stays true.
 */
export function AppFooter() {
  return (
    <footer className="app-footer">
      <span>
        <strong>Ballast</strong> — a tool from Newton&rsquo;s First Labs
      </span>
      <span className="app-footer__links">
        <a href={REPO} target="_blank" rel="noreferrer noopener">Source on GitHub</a>
        <a href="/privacy.html">Privacy</a>
        <span className="subtle">Your work stays in this browser</span>
      </span>
    </footer>
  );
}
