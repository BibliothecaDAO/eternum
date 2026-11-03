import { useEffect, useSyncExternalStore } from "react";

/** Less than this lost at the screen's foot is a browser bar coming and going, not an on-screen keyboard. */
const KEYBOARD_LEAST_PX = 120;
/** A visual viewport scaled further from 1 than this is pinch-zoomed: it shows less of the page, with no keyboard. */
const ZOOM_TOLERANCE = 0.01;
/** The inputs a phone types into with its keyboard; a checkbox, a slider or a button takes a tap and raises none. */
const TYPED_INPUTS = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

/** Whether the focus is in a field the on-screen keyboard types into: the only time a phone shows one. */
const isTypingInto = (element: Element | null): boolean =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && TYPED_INPUTS.has(element.type)) ||
  (element instanceof HTMLElement && element.isContentEditable);

/**
 * How much of the layout viewport's foot the on-screen keyboard covers: what the visual viewport no longer shows of it,
 * as the keyboard overlays the page (Android Chrome) or pushes the visible part up (iOS Safari) while the layout stays
 * as it was. Only while a field typed into has the focus and the page is not pinch-zoomed: a zoom shows less of the
 * page too, and a page not being typed in raises no keyboard.
 */
const keyboardInsetOf = (
  layoutHeight: number,
  visual: { height: number; offsetTop: number; scale: number },
  focused: Element | null,
): number => {
  if (!isTypingInto(focused) || Math.abs(visual.scale - 1) > ZOOM_TOLERANCE) return 0;
  const inset = Math.round(layoutHeight - visual.height - visual.offsetTop);
  return inset >= KEYBOARD_LEAST_PX ? inset : 0;
};

/** The keyboard's height as last read, and who follows it: one reading, whatever changed it (a resize, a scroll). */
let held = 0;
const followers = new Set<() => void>();
const hold = (inset: number) => {
  if (inset === held) return;
  held = inset;
  for (const follow of followers) follow();
};
const follow = (change: () => void) => {
  followers.add(change);
  return () => followers.delete(change);
};

/**
 * The on-screen keyboard's height now (0 closed), as useKeyboardInset last read it: for code that measures what the
 * keyboard moves (a sheet's anchor), so it measures again on every change of it, whatever caused the change.
 */
export const useKeyboardHeight = (): number =>
  useSyncExternalStore(
    follow,
    () => held,
    () => 0,
  );

/**
 * The on-screen keyboard, for every layout that stands on the screen's foot: `--keyboard` on the root is how tall it is
 * (0 when closed), so a phone's page, HUD and chat end above it, and `data-keyboard` marks it open, so what is marked
 * `data-keyboard-hides` (what stands at the foot for moving between places, a game's top band) steps aside while the
 * player types. Read from the visual viewport as it changes, and again as the focus moves: into a field at once, and
 * out of one after the focus has landed elsewhere.
 */
export const useKeyboardInset = () =>
  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;
    const root = document.documentElement;
    const update = () => {
      const inset = keyboardInsetOf(root.clientHeight, visual, document.activeElement);
      root.style.setProperty("--keyboard", `${inset}px`);
      if (inset > 0) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
      hold(inset);
    };
    let focusMoved: ReturnType<typeof setTimeout> | undefined;
    const afterFocusMoves = () => {
      clearTimeout(focusMoved);
      focusMoved = setTimeout(update, 0);
    };
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", afterFocusMoves);
    return () => {
      clearTimeout(focusMoved);
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", afterFocusMoves);
      root.style.removeProperty("--keyboard");
      delete root.dataset.keyboard;
      hold(0);
    };
  }, []);
