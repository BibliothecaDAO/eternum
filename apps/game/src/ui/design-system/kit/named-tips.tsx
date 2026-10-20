import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useEffect } from "react";

/**
 * What names itself: anything carrying a line of its own (`data-tip`), and every chip, icon, meter and wordless
 * button that already carries its name for a screen reader. A new chip is named by being a chip.
 */
const NAMED = '[data-tip], [role="img"][aria-label], [role="meter"][aria-label], button[aria-label]';

/** A press this long on a touch screen asks for the name; a shorter one is the tap it always was. */
const HOLD_MS = 450;
/** A finger that travels this far is scrolling, not asking. */
const HOLD_SLOP_PX = 10;
/** A held name stays this long after the finger lifts, so it can be read uncovered. */
const LINGER_MS = 1_600;
/** Within this much of the screen's top a name has no room above its thing. */
const TOP_EDGE_PX = 96;

type Named = { anchor: HTMLElement; line: string };

/** A name on the tooltip, in the HUD sheet's tip line (the tooltip wraps it inside a phone's width). */
export const TipLine = ({ line }: { line: string }) => <span className="ui-tip__line">{line}</span>;

const squeezed = (words: string) => words.replace(/\s+/g, "").toLowerCase();

/** Whether the element already shows these words. */
const shows = (anchor: HTMLElement, words: string) => squeezed(anchor.textContent ?? "").includes(squeezed(words));

/** Whether any of the element's words are cut off at its edge, so a line that repeats them still says something. */
const cutOff = (anchor: HTMLElement) =>
  [anchor, ...anchor.querySelectorAll<HTMLElement>("*")].some(
    (node) => node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight,
  );

/** A meter says its reading with its name: "stamina 81 / 150". */
const meterLine = (meter: HTMLElement, name: string) => {
  const now = meter.getAttribute("aria-valuenow");
  const max = meter.getAttribute("aria-valuemax");
  return now === null || max === null ? name : `${name} ${now} / ${max}`;
};

/**
 * The line an element under the pointer shows: its own `data-tip`, else its accessible name. Words the element
 * already shows whole (a button reading "Deploy", an event row's own sentence) are not said twice; words cut off at
 * its edge are.
 */
const namedAt = (target: EventTarget | null): Named | null => {
  const anchor = target instanceof Element ? target.closest<HTMLElement>(NAMED) : null;
  if (!anchor) return null;
  const own = anchor.dataset.tip;
  if (own !== undefined) return own === "" || (shows(anchor, own) && !cutOff(anchor)) ? null : { anchor, line: own };
  const name = anchor.getAttribute("aria-label") ?? "";
  if (name === "" || shows(anchor, name)) return null;
  return { anchor, line: anchor.getAttribute("role") === "meter" ? meterLine(anchor, name) : name };
};

/** A name sits above its thing, clear of the finger; under it when the thing is at the top of the screen. */
const sideFor = (anchor: HTMLElement) => (anchor.getBoundingClientRect().top < TOP_EDGE_PX ? "bottom" : "top");

/**
 * The kit's one tooltip behaviour, feeding the app's one tooltip: a name shows while the mouse is over it, while the
 * keyboard's focus is on it, and after a press-and-hold on a touch screen (the hold is not a tap: its click is
 * swallowed). Mounted once, with the tooltip; no chip or call site asks for it.
 */
export const useNamedTips = (): void => {
  useEffect(() => {
    const { setTooltip } = useTooltipStore.getState();
    let shown: HTMLElement | null = null;
    let hold: { timer: number; x: number; y: number } | null = null;
    let linger: number | undefined;
    let heldThisPress = false;

    const show = ({ anchor, line }: Named, held: boolean) => {
      window.clearTimeout(linger);
      shown = anchor;
      setTooltip({ content: <TipLine line={line} />, anchorElement: anchor, position: sideFor(anchor), held });
    };
    const hide = () => {
      window.clearTimeout(linger);
      if (!shown) return;
      shown = null;
      setTooltip(null);
    };
    const dropHold = () => {
      if (hold) window.clearTimeout(hold.timer);
      hold = null;
    };

    const hover = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const named = namedAt(event.target);
      if (!named) hide();
      else if (named.anchor !== shown) show(named, false);
    };
    const focus = (event: FocusEvent) => {
      const named = namedAt(event.target);
      if (named && named.anchor.matches(":focus-visible")) show(named, false);
    };
    const press = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      hide();
      dropHold();
      heldThisPress = false;
      const named = namedAt(event.target);
      if (!named) return;
      const timer = window.setTimeout(() => {
        hold = null;
        heldThisPress = true;
        show(named, true);
      }, HOLD_MS);
      hold = { timer, x: event.clientX, y: event.clientY };
    };
    const travel = (event: PointerEvent) => {
      if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > HOLD_SLOP_PX) dropHold();
    };
    const lift = () => {
      dropHold();
      if (heldThisPress) linger = window.setTimeout(hide, LINGER_MS);
    };
    /** A hold is not a tap: the click it would end in goes nowhere. */
    const swallowClickAfterHold = (event: Event) => {
      if (!heldThisPress) return;
      heldThisPress = false;
      event.preventDefault();
      event.stopPropagation();
    };
    /** Nor does a hold on a name open the browser's long-press menu. */
    const keepMenuShut = (event: Event) => {
      if (hold || heldThisPress) event.preventDefault();
    };

    document.addEventListener("pointerover", hover);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", press);
    document.addEventListener("pointermove", travel);
    document.addEventListener("pointerup", lift);
    document.addEventListener("pointercancel", lift);
    document.addEventListener("click", swallowClickAfterHold, true);
    document.addEventListener("contextmenu", keepMenuShut, true);
    return () => {
      dropHold();
      hide();
      document.removeEventListener("pointerover", hover);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("pointermove", travel);
      document.removeEventListener("pointerup", lift);
      document.removeEventListener("pointercancel", lift);
      document.removeEventListener("click", swallowClickAfterHold, true);
      document.removeEventListener("contextmenu", keepMenuShut, true);
    };
  }, []);
};
