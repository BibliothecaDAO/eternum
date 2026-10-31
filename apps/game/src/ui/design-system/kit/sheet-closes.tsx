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
 * A drag down on a sheet's head closes it, on a touch screen: the handlers to spread on the head, and whether the press
 * that just ended was such a drag (so its click does not act too). A mouse never drags a sheet away.
 */
export const useDragDownCloses = (onClose: () => void) => {
  const from = useRef<number | null>(null);
  const dragged = useRef(false);
  const onPointerDown = (event: PointerEvent) => {
    from.current = event.pointerType === "mouse" ? null : event.clientY;
    dragged.current = false;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (from.current !== null && event.clientY - from.current >= DRAG_CLOSES_PX) {
      dragged.current = true;
      onClose();
    }
    from.current = null;
  };
  return { handlers: { onPointerDown, onPointerUp }, dragged };
};

/**
 * A sheet's handle on a phone: a 48 tall strip across its top, `children` its grip. A tap closes the sheet, and so does a
 * drag down.
 */
export const SheetHandle = ({ onClose, children }: { onClose: () => void; children: ReactNode }) => {
  const drag = useDragDownCloses(onClose);
  return (
    <button
      type="button"
      aria-label={CLOSE}
      {...drag.handlers}
      onClick={() => !drag.dragged.current && onClose()}
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

/**
 * A layer drawn over every surface (a select's list) belongs to the control that opened it, which names it with
 * `aria-controls`: whether `target` is in such a layer, opened by a control inside `from`.
 */
export const isInLayerOpenedFrom = (target: EventTarget | null, from: ParentNode): boolean => {
  const opened = new Set(
    [...from.querySelectorAll("[aria-controls]")].map((control) => control.getAttribute("aria-controls")),
  );
  for (let node = target instanceof Element ? target : null; node !== null; node = node.parentElement) {
    if (node.id && opened.has(node.id)) return true;
  }
  return false;
};

/** Whether `target` is a control whose layer is open now (a field suggesting from its list: chat's mentions). */
const hasLayerOpen = (target: EventTarget | null) =>
  target instanceof Element && target.getAttribute("aria-expanded") === "true" && target.hasAttribute("aria-controls");

/**
 * Escape closes the sheet and stops there: taken before the map's shortcuts, which leave a key a surface took. An Escape
 * in a layer a control opened (a select's list), or on the control while its layer is open, is that layer's: it closes
 * the list, not the sheet.
 */
const useEscapeCloses = (close: () => void) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isInLayerOpenedFrom(event.target, document) || hasLayerOpen(event.target)) return;
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
 * Whether the newest entry belongs to a sheet that has just closed and not stepped back yet: one the press that opens
 * the next replaced (Menu's row opening the Season, a place bar slot opening another page).
 */
const topSheetLeft = () => {
  const top = openSheets().at(-1);
  return top !== undefined && !mounted.has(top) && !steppingBack.has(top);
};

/**
 * The system back closes the sheet, not the page under it. Opening pushes a history entry naming the sheet (on top of
 * the router's own state, so its index is unchanged); a back that lands on an entry without that name closes it. A sheet
 * that replaces one closing in the same press takes over its entry, and one opened while a closed sheet still steps back
 * takes its entry once that step lands, so every entry names a sheet on screen. A sheet closed any other way steps back
 * off its own entry, so the back button never has to be pressed twice.
 */
const useSystemBackCloses = (close: () => void) => {
  const id = useId();
  const closeRef = useLatest(close);
  useEffect(() => {
    mounted.add(id);
    let entered = false;
    const enter = () => {
      if (!mounted.has(id)) return;
      entered = true;
      if (openSheets().includes(id)) return;
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      if (topSheetLeft()) window.history.replaceState({ ...state, kitSheets: [...openSheets().slice(0, -1), id] }, "");
      else window.history.pushState({ ...state, kitSheets: [...openSheets(), id] }, "");
    };
    const onPop = () => {
      if (entered && !openSheets().includes(id)) closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    if (steppingBack.size > 0) window.addEventListener("popstate", () => setTimeout(enter), { once: true });
    else enter();
    return () => {
      mounted.delete(id);
      window.removeEventListener("popstate", onPop);
      setTimeout(() => stepBackOffEntry(id));
    };
  }, [id, closeRef]);
};
