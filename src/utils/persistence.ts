import type { Idea, Measure, Theme, Tag } from '../types';

/**
 * Local persistence.
 *
 * Everything stays in the browser — nothing is ever sent anywhere. Stored state is
 * versioned and validated on read: anything that fails validation is discarded with
 * a message rather than being fed unchecked into React state, since stored content
 * is user-supplied and a schema change would otherwise crash the app on load.
 */

const KEY = 'ballast/state';
const VERSION = 1;

export interface PersistedState {
  ideas: Idea[];
  measures: Measure[];
  themes: Theme[];
  tags: Tag[];
  savedAt: string;
}

interface Envelope { version: number; state: PersistedState; }

export type LoadOutcome =
  | { status: 'empty' }
  | { status: 'ok'; state: PersistedState }
  | { status: 'discarded'; reason: string };

export function saveState(state: Omit<PersistedState, 'savedAt'>): void {
  try {
    const envelope: Envelope = { version: VERSION, state: { ...state, savedAt: new Date().toISOString() } };
    localStorage.setItem(KEY, JSON.stringify(envelope));
  } catch {
    // Storage full or blocked (private browsing). Losing the save is acceptable;
    // losing the session to an exception is not.
  }
}

export function loadState(): LoadOutcome {
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); } catch { return { status: 'empty' }; }
  if (!raw) return { status: 'empty' };

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return discard('the saved data was not readable'); }

  if (!isEnvelope(parsed)) return discard('the saved data was not in the expected shape');
  if (parsed.version !== VERSION) return discard(`it was saved by an older version of this tool (v${parsed.version})`);
  if (!isValidState(parsed.state)) return discard('the saved data failed validation');

  return { status: 'ok', state: parsed.state };
}

export function clearState(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}

function discard(reason: string): LoadOutcome {
  clearState();
  return { status: 'discarded', reason };
}

function isEnvelope(v: unknown): v is Envelope {
  return !!v && typeof v === 'object' && 'version' in v && 'state' in v && typeof (v as Envelope).version === 'number';
}

function isValidState(s: unknown): s is PersistedState {
  if (!s || typeof s !== 'object') return false;
  const c = s as PersistedState;
  if (!Array.isArray(c.ideas) || !Array.isArray(c.measures) || !Array.isArray(c.themes) || !Array.isArray(c.tags)) return false;
  const measureOk = c.measures.every(m =>
    m && typeof m.id === 'string' && typeof m.name === 'string' &&
    typeof m.min === 'number' && typeof m.max === 'number' &&
    (m.type === 'directional' || m.type === 'bipolar'));
  const ideaOk = c.ideas.every(i =>
    i && typeof i.id === 'string' && typeof i.name === 'string' &&
    i.values && typeof i.values === 'object' &&
    ['now', 'next', 'later', 'not-planned'].includes(i.priority));
  return measureOk && ideaOk;
}
