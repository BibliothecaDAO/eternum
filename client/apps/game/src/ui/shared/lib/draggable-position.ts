import { useLayoutEffect, useRef, useState } from "react";
import type { DraggableData, DraggableEvent } from "react-draggable";

interface DraggablePosition {
  /** Ref for react-draggable's `nodeRef` and the dragged element. */
  nodeRef: React.RefObject<HTMLDivElement>;
  /** Controlled position passed to `<Draggable position>`. */
  position: { x: number; y: number };
  /** Pass to `<Draggable onDrag>` so the controlled position tracks the drag. */
  onDrag: (event: DraggableEvent, data: DraggableData) => void;
  /** Pass to `<Draggable onStop>` to persist the latest position. */
  onStop: (event: DraggableEvent, data: DraggableData) => void;
}

const readPosition = (persistKey?: string): { x: number; y: number } => {
  if (!persistKey) return { x: 0, y: 0 };
  try {
    const stored = localStorage.getItem(persistKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        return { x: parsed.x, y: parsed.y };
      }
    }
  } catch {
    // ignore malformed/unavailable storage
  }
  return { x: 0, y: 0 };
};

const persist = (persistKey: string | undefined, pos: { x: number; y: number }) => {
  if (!persistKey) return;
  try {
    localStorage.setItem(persistKey, JSON.stringify(pos));
  } catch {
    // ignore storage write failures (private mode, quota, etc.)
  }
};

/**
 * Shared drag-position persistence for draggable HUD windows. The window is
 * controlled (`position` prop) so a restored position can be corrected: on
 * mount we measure the element and, if a stale saved offset (e.g. from a
 * different layout) pushed the drag handle above/off the viewport, we nudge it
 * back so the header is always grabbable. Live dragging is bounds-clamped by
 * the consumer's `<Draggable bounds="parent">`.
 *
 * Without a `persistKey` the window opens centered and nothing is persisted.
 */
export const useDraggablePosition = (persistKey?: string): DraggablePosition => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => readPosition(persistKey));

  // Keep the header on-screen: correct any restored position that would place
  // the panel's top edge above the viewport (un-grabbable) or fully off to a
  // side. Runs once after the first layout, before paint.
  useLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const MARGIN = 8;
    // Header must stay below the top edge and above the bottom edge.
    const maxTop = window.innerHeight - 48;
    let dx = 0;
    let dy = 0;
    if (rect.top < MARGIN) dy = MARGIN - rect.top;
    else if (rect.top > maxTop) dy = maxTop - rect.top;
    // Keep a usable strip of the panel horizontally on-screen.
    if (rect.left > window.innerWidth - 80) dx = window.innerWidth - 80 - rect.left;
    else if (rect.right < 80) dx = 80 - rect.right;
    if (dx !== 0 || dy !== 0) {
      setPosition((prev) => {
        const next = { x: prev.x + dx, y: prev.y + dy };
        persist(persistKey, next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrag = (_event: DraggableEvent, data: DraggableData) => {
    setPosition({ x: data.x, y: data.y });
  };

  const onStop = (_event: DraggableEvent, data: DraggableData) => {
    setPosition({ x: data.x, y: data.y });
    persist(persistKey, { x: data.x, y: data.y });
  };

  return { nodeRef, position, onDrag, onStop };
};
