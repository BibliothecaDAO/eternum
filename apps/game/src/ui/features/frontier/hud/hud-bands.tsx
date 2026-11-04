import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";

import { useKeyboardHeight } from "@/hooks/use-keyboard-inset";
import { useSideways } from "@/shell/frame/layout";
import { HUD_COLUMN_MARK, HUD_FOOT_MARK, HUD_TOP_MARK } from "@/three/utils/labels/hud-clearance";

/** The phone's safe area; the on-screen keyboard covers the home indicator, so while it is up the foot keeps none for it. */
const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(calc(env(safe-area-inset-bottom) - var(--keyboard, 0px)), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/** The bands' gap (gap-1.5), kept between a sheet and what it stands on. */
const BAND_GAP = 6;

/** Every slot of a phone's HUD, as Frontier fills them. */
type Bands = {
  strip: ReactNode;
  /** The realm's LORDS and its Realms' labor, under the strip at its right. */
  purse?: ReactNode;
  /** A nav page, standing on the place bar; one marked `data-page-fills` (Chat) takes the band up to the strip. */
  page?: ReactNode;
  notices?: ReactNode;
  action?: ReactNode;
  dock?: ReactNode;
  nav?: ReactNode;
  children?: ReactNode;
};

/**
 * Frontier's HUD on a phone (owner, 22 October 2026: mobile direction A, the map first). Held upright, in bands: the
 * strip and the purse on top, the map in the middle, and the foot read upward from the place bar: the dock, the action
 * row, the notices. Held sideways, the places stand in a rail at the left and the rest in one column at the right, the
 * map between them. A nav page (Research, the Log, Chat, the season) stands where the action row and the dock stood, and
 * the map stays clear of it; a sheet stands in the same place (`--hud-phone-foot` upright, `--hud-sheet-top` sideways,
 * which hud-sheet.css reads), as tall as what it holds up to the phone panel's height, which also keeps the map 40% of
 * the screen between the strip and the place bar (`--hud-phone-top`, `--hud-phone-foot`). While either is open, the action
 * row and the dock step aside under it and the purse's row folds away, so the map keeps what they took (owner, 26 October
 * 2026: layout A); the notices stay. A page that marks itself `data-page-fills` (Chat) takes the whole band from the strip
 * to the place bar, the map hidden behind it: a page read and written in, not glanced at over the map. The page says
 * so itself, so wherever it is drawn (the game, the lab) it stands the same. While the on-screen keyboard is up, the
 * strip and the purse step aside with the place bar (`data-keyboard-hides`), so what is typed in has the screen above the
 * keyboard (owner, 3 November 2026: Chat's history was gone while typing). A desktop has the HUD every mode shares (FrontierDesktop).
 */
export const HudBands = (bands: Bands) => (useSideways() ? <SidewaysBands {...bands} /> : <UprightBands {...bands} />);

const UprightBands = ({ strip, purse, page, notices, action, dock, nav, children }: Bands) => {
  const bar = useRef<HTMLDivElement>(null);
  // A sheet stands on the place bar: its top, from the screen's bottom. The box measured holds the bar and keeps its
  // place at the band's foot while the bar steps aside for the keyboard, so a sheet then stands on the keyboard.
  const foot = useEdge(bar, (rect) => window.innerHeight - rect.top + BAND_GAP);
  // Where the strip ends: the phone panel's cap keeps the map its least share between this and the place bar.
  const topBand = useRef<HTMLDivElement>(null);
  const top = useEdge(topBand, (rect) => rect.bottom + BAND_GAP);
  return (
    <div
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-hud-keyboard z-30 flex flex-col gap-1.5 font-sans [&:has([data-kit-sheet])_[data-under-sheet]]:hidden [&:has([data-kit-sheet],[data-page])_[data-top-row]]:hidden [&:has([data-page-fills])_[data-map-band]]:hidden"
      style={{ ...SAFE_AREA, "--hud-phone-foot": `${foot}px`, "--hud-phone-top": `${top}px` } as CSSProperties}
    >
      <div ref={topBand} {...HUD_TOP_MARK} data-keyboard-hides className="flex flex-col gap-1.5">
        <div className="relative">{strip}</div>
        <TopRow purse={purse} />
      </div>
      <div data-map-band className="relative min-h-0 flex-1" />
      <div {...HUD_FOOT_MARK} className="flex min-h-0 flex-col gap-1.5 [&:has([data-page-fills])]:flex-1">
        <div className="flex flex-col gap-1.5">{notices}</div>
        {page ? (
          <PageBand className="max-h-hud-phone-panel [&:has([data-page-fills])]:max-h-none [&:has([data-page-fills])]:flex-1">
            {page}
          </PageBand>
        ) : (
          <UnderSheet action={action} dock={dock} />
        )}
        <div ref={bar}>
          <div data-keyboard-hides>{nav}</div>
        </div>
      </div>
      {children}
    </div>
  );
};

const SidewaysBands = ({ strip, purse, page, notices, action, dock, nav, children }: Bands) => {
  const top = useRef<HTMLDivElement>(null);
  // A sheet stands in the column under the strip and the purse.
  const sheetTop = useEdge(top, (rect) => rect.bottom + BAND_GAP);
  return (
    <div
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-hud-keyboard z-30 flex gap-1.5 font-sans [&:has([data-kit-sheet])_[data-under-sheet]]:hidden [&:has([data-kit-sheet],[data-page])_[data-top-row]]:hidden"
      style={{ ...SAFE_AREA, "--hud-sheet-top": `${sheetTop}px` } as CSSProperties}
    >
      <div {...HUD_COLUMN_MARK} className="flex">
        {nav}
      </div>
      <div className="relative min-w-0 flex-1" />
      <div {...HUD_COLUMN_MARK} className="flex min-h-0 w-hud-column flex-col gap-1.5">
        <div ref={top} data-keyboard-hides className="flex flex-col gap-1.5">
          <div className="relative">{strip}</div>
          <TopRow purse={purse} />
        </div>
        <div className="flex flex-col gap-1.5">{notices}</div>
        {page ? <PageBand className="flex-1">{page}</PageBand> : <UnderSheet action={action} dock={dock} />}
      </div>
      {children}
    </div>
  );
};

/** Under the strip: the purse at its right; folded away while a sheet or a page is open. */
const TopRow = ({ purse }: { purse: ReactNode }) => (
  <div data-top-row className="flex items-start justify-end gap-1.5">
    {purse}
  </div>
);

/** A nav page's place: as tall as its band gives, scrolling inside. */
const PageBand = ({ className, children }: { className: string; children: ReactNode }) => (
  <div data-page className={`flex min-h-0 flex-col ${className}`}>
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
  </div>
);

/** The action row and the dock, at the band's foot; a sheet stands over them and they step aside. */
const UnderSheet = ({ action, dock }: { action: ReactNode; dock: ReactNode }) => (
  <div data-under-sheet className="mt-auto flex flex-col gap-1.5">
    {action}
    <div>{dock}</div>
  </div>
);

/**
 * An edge of an element on screen, read again whenever the element or the screen changes size, and whenever the
 * on-screen keyboard does (useKeyboardHeight: the bands end on it, so everything in them moves with it).
 */
const useEdge = (ref: RefObject<HTMLElement>, edge: (rect: DOMRect) => number) => {
  const [value, setValue] = useState(0);
  const read = useRef(edge);
  read.current = edge;
  const keyboard = useKeyboardHeight();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setValue(Math.round(read.current(element.getBoundingClientRect())));
    measure();
    // The element's height changes with its badges and the safe area, the screen's with its turning.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, keyboard]);
  return value;
};
