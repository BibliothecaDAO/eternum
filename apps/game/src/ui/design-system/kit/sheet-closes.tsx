import { type PointerEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef } from "react";

import { CLOSE } from "./words";

/** A drag on the handle this far down closes the sheet, as a tap on it does. */
const DRAG_CLOSES_PX = 64;

/**
 * How a sheet closes, whatever it looks like: Escape, and the system back, which closes the sheet rather than the page
 * under it.
 */
export const useSheetCloses = (onClose: () => void) => {
  const close = useLatest(onClose);
  useSystemBackCloses(() => close.current());
  useEscapeCloses(() => close.current());
};

/**
 * A sheet's handle on a phone: a 48 tall strip across its top, `children` its grip. A tap closes the sheet, and so does a
 * drag down.
 */
export const SheetHandle = ({ onClose, children }: { onClose: () => void; children: ReactNode }) => {
  const from = useRef<number | null>(null);
  const dragged = useRef(false);
  const start = (event: PointerEvent) => {
    from.current = event.clientY;
    dragged.current = false;
  };
  const end = (event: PointerEvent) => {
    if (from.current !== null && event.clientY - from.current >= DRAG_CLOSES_PX) {
      dragged.current = true;
      onClose();
    }
    from.current = null;
  };
  return (
    <button
      type="button"
      aria-label={CLOSE}
      onPointerDown={start}
      onPointerUp={end}
      onClick={() => !dragged.current && onClose()}
      className="flex h-12 w-full shrink-0 touch-none items-center justify-center lg:hidden"
    >
      {children}
    </button>
  );
};

/** The latest value for handlers bound once, refreshed after each render rather than during it. */
const useLatest = <T,>(value: T) => {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};

/** Escape closes the sheet and stops there: taken before the map's shortcuts, which leave a key a surface took. */
const useEscapeCloses = (close: () => void) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);
};

type SheetHistoryState = { kitSheets?: string[] } | null;

const openSheets = (): string[] => (window.history.state as SheetHistoryState)?.kitSheets ?? [];

/** Sheets mounted now. An unmount steps back only if its sheet did not mount again at once (React's dev double mount). */
const mounted = new Set<string>();

/**
 * Sheets whose step back is under way. History moves a moment after it is asked to, so until it has, a second
 * unmount of the same sheet (React's dev double mount, closed in the tick it opened) would step back again, off the
 * page.
 */
const steppingBack = new Set<string>();

const stepBackOffEntry = (id: string) => {
  if (mounted.has(id) || steppingBack.has(id) || openSheets().at(-1) !== id) return;
  steppingBack.add(id);
  window.addEventListener("popstate", () => steppingBack.delete(id), { once: true });
  window.history.back();
};

/**
 * The system back closes the sheet, not the page under it. Opening pushes a history entry naming the sheet (on top of
 * the router's own state, so its index is unchanged); a back that lands on an entry without that name closes it. A sheet
 * closed any other way steps back off its own entry, so the back button never has to be pressed twice.
 */
const useSystemBackCloses = (close: () => void) => {
  const id = useId();
  const closeRef = useLatest(close);
  useEffect(() => {
    mounted.add(id);
    if (!openSheets().includes(id)) {
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...state, kitSheets: [...openSheets(), id] }, "");
    }
    const onPop = () => {
      if (!openSheets().includes(id)) closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      mounted.delete(id);
      window.removeEventListener("popstate", onPop);
      setTimeout(() => stepBackOffEntry(id));
    };
  }, [id, closeRef]);
};
