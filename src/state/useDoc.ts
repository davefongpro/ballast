import { useCallback, useRef, useState } from 'react';
import type { Idea, Measure, Theme, Tag } from '../types';

/**
 * The document — everything a user's work consists of — held as one value, with
 * an undo stack and a baseline.
 *
 * Two reasons it is one object rather than four pieces of state:
 *
 * 1. **Undo has to be one step per action.** Pasting two hundred cells is one
 *    thing the user did, so it is one thing to undo. That only works if a whole
 *    document snapshot goes on the stack, not an individual cell.
 * 2. **The baseline needs the same shape.** "Was 6 when you opened this" is a
 *    comparison against a whole document captured at a known moment.
 */

export interface Doc {
  ideas: Idea[];
  measures: Measure[];
  themes: Theme[];
  tags: Tag[];
}

interface Past { doc: Doc; label: string; }

/** How many steps back the user can go. Beyond this, the oldest is dropped. */
const HISTORY_LIMIT = 40;

export interface DocApi {
  doc: Doc;
  /** Replace the document, recording one undoable step described by `label`. */
  commit: (label: string, next: Doc | ((prev: Doc) => Doc)) => void;
  /** Replace the document AND reset the baseline — a load, import or revert. */
  reset: (next: Doc, at?: Date) => void;
  undo: () => void;
  canUndo: boolean;
  /** What undo would reverse, for the button's label. */
  undoLabel: string | null;
  baselineAt: Date;
  /** The baseline value of one measure on one idea, or undefined if it is new. */
  baselineValue: (ideaId: string, measureId: string) => number | undefined;
}

export function useDoc(initial: Doc, initialBaselineAt = new Date()): DocApi {
  const [doc, setDoc] = useState<Doc>(initial);
  const [past, setPast] = useState<Past[]>([]);
  const baseline = useRef<Doc>(structuredClone(initial));
  const [baselineAt, setBaselineAt] = useState<Date>(initialBaselineAt);

  const commit = useCallback((label: string, next: Doc | ((prev: Doc) => Doc)) => {
    setDoc(prev => {
      const resolved = typeof next === 'function' ? (next as (p: Doc) => Doc)(prev) : next;
      if (resolved === prev) return prev;
      setPast(stack => [...stack, { doc: prev, label }].slice(-HISTORY_LIMIT));
      return resolved;
    });
  }, []);

  const reset = useCallback((next: Doc, at: Date = new Date()) => {
    setDoc(next);
    setPast([]);
    baseline.current = structuredClone(next);
    setBaselineAt(at);
  }, []);

  const undo = useCallback(() => {
    setPast(stack => {
      if (stack.length === 0) return stack;
      const last = stack[stack.length - 1];
      setDoc(last.doc);
      return stack.slice(0, -1);
    });
  }, []);

  const baselineValue = useCallback((ideaId: string, measureId: string) => {
    return baseline.current.ideas.find(i => i.id === ideaId)?.values[measureId];
  }, []);

  return {
    doc,
    commit,
    reset,
    undo,
    canUndo: past.length > 0,
    undoLabel: past.length > 0 ? past[past.length - 1].label : null,
    baselineAt,
    baselineValue,
  };
}
