import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type ReactNode, type PointerEvent, useEffect, useId, useLayoutEffect, useRef } from "react";

import { CLOSE } from "./words";

/** A drag on the handle this far down closes the sheet, as a tap on it does. */
const DRAG_CLOSES_PX = 64;

/**
 * The kit's sheet: a bottom sheet on a phone, the right panel on a desktop. It closes from its handle (a tap or a drag
 * down), a tap on the stage behind it (phone only: on a desktop the stage stays playable beside the panel), Escape, or
 * the system back.
 */
export const Sheet = ({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) => {
  const close = useLatest(onClose);
  useSystemBackCloses(() => close.current());
  useEscapeCloses(() => close.current());
  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="pointer-events-auto fixed inset-0 z-30 cursor-default lg:hidden"
      />
      <section
        role="dialog"
        aria-label={label}
        data-kit-sheet
        className={cn(
          "frontier-sheet pointer-events-auto fixed z-40 flex flex-col font-sans",
          "inset-x-0 bottom-0 max-h-[85dvh]",
          "lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:w-[400px] lg:!rounded-3xl lg:!border",
        )}
      >
        <Handle onClose={onClose} />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </section>
    </>
  );
};

/** The handle: a 48 tall strip across the sheet's top. A tap closes the sheet, and so does a drag down. */
const Handle = ({ onClose }: { onClose: () => void }) => {
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
      className="flex h-12 w-full shrink-0 touch-none items-center justify-center"
    >
      <i className="frontier-handle" />
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

const useEscapeCloses = (close: () => void) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
};

type SheetHistoryState = { kitSheets?: string[] } | null;

const openSheets = (): string[] => (window.history.state as SheetHistoryState)?.kitSheets ?? [];

/** Sheets mounted now. An unmount steps back only if its sheet did not mount again at once (React's dev double mount). */
const mounted = new Set<string>();

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
      setTimeout(() => {
        if (!mounted.has(id) && openSheets().at(-1) === id) window.history.back();
      });
    };
  }, [id, closeRef]);
};
