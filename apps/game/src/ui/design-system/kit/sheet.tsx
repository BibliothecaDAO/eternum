import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type ReactNode, type PointerEvent, useContext, useEffect, useId, useLayoutEffect, useRef } from "react";

import { KitIcon } from "./kit-icon";
import { OpenedFromPanel } from "./opened-from-panel";
import { BACK, CLOSE } from "./words";

/** A drag on the handle this far down closes the sheet, as a tap on it does. */
const DRAG_CLOSES_PX = 64;

/** Where a desktop sheet docks: under the match's bar, or on an app page's right under its title (left of no rail). */
const DESKTOP_PLACEMENT = {
  bar: "lg:right-2 lg:top-[76px] lg:max-h-[calc(100dvh-84px)]",
  page: "lg:right-8 lg:top-[100px] lg:max-h-[calc(100dvh-124px)]",
} as const;

/**
 * The kit's sheet: a bottom sheet on a phone; on a desktop a panel docked in the leaderboard's place under the bar (or,
 * placed on a page, at the page's right under its title, clear of the notice), as tall as its content, with no handle. It closes from its handle (a tap or a drag down) or a tap on
 * the stage behind it on a phone, from its mark on a desktop (a cross, or a back arrow when it opened from another
 * panel), and from Escape or the system back on both. A desktop stage stays playable beside the panel.
 */
export const Sheet = ({
  label,
  onClose,
  placement = "bar",
  children,
}: {
  label: string;
  onClose: () => void;
  placement?: keyof typeof DESKTOP_PLACEMENT;
  children: ReactNode;
}) => {
  const fromPanel = useContext(OpenedFromPanel);
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
          // Visible even when the panel it opened from steps aside for it (HudBands hides that panel).
          "frontier-sheet pointer-events-auto visible fixed z-40 flex flex-col font-sans",
          "inset-x-0 bottom-0 max-h-[85dvh]",
          "lg:inset-x-auto lg:bottom-auto lg:w-[440px]",
          DESKTOP_PLACEMENT[placement],
        )}
      >
        <Handle onClose={onClose} />
        <Mark back={fromPanel} onClose={onClose} />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pt-3.5">
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
      className="flex h-12 w-full shrink-0 touch-none items-center justify-center lg:hidden"
    >
      <i className="frontier-handle" />
    </button>
  );
};

/** A desktop panel's own way out on its top edge: a cross, or a back arrow to the panel it opened from. */
const Mark = ({ back, onClose }: { back: boolean; onClose: () => void }) => (
  <button
    type="button"
    aria-label={back ? BACK : CLOSE}
    onClick={onClose}
    className={cn(
      "absolute -top-2.5 right-3.5 z-10 hidden size-8 items-center justify-center rounded-full border-[1.5px] border-kit-line2 bg-kit-ink shadow-[0_2px_8px_rgba(0,0,0,0.6)] hover:border-kit-gold lg:flex",
      !back &&
        "before:absolute before:h-[2.5px] before:w-3.5 before:rotate-45 before:rounded-sm before:bg-kit-gold before:content-[''] after:absolute after:h-[2.5px] after:w-3.5 after:-rotate-45 after:rounded-sm after:bg-kit-gold after:content-['']",
    )}
  >
    {back && <KitIcon code="Bk" size={20} />}
  </button>
);

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
