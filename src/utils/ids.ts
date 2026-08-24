/**
 * Collision-safe id generation.
 *
 * The previous scheme was `${prefix}-${Date.now()}-${index}`, which collides
 * whenever two ids are minted in the same millisecond with the same index —
 * routinely true during an import loop. A collision silently merges two rows in
 * React's reconciler, so this uses `crypto.randomUUID` where available and a
 * counter-plus-random fallback where it is not.
 */

let counter = 0;

export function makeId(prefix: string): string {
  counter += 1;
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  const rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${rand}`;
}
