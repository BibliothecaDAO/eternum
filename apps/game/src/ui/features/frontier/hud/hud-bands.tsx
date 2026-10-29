import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";

import { useSideways } from "@/shell/frame/layout";
import { HUD_COLUMN_MARK, HUD_FOOT_MARK, HUD_TOP_MARK } from "@/three/utils/labels/hud-clearance";
import { OpenedFromPanel } from "@/ui/design-system/kit/opened-from-panel";

const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/** The bands' gap (gap-1.5), kept between a sheet and what it stands on. */
const BAND_GAP = 6;

/** Every slot of a phone's HUD, as Frontier fills them. */
type Bands = {
  strip: ReactNode;
  /** The realm's LORDS and its Realms' labor, beside Next up under the strip. */
  purse?: ReactNode;
  /** A nav page, standing on the place bar; one marked `data-page-fills` (Chat) takes the band up to the strip. */
  page?: ReactNode;
  nextUp?: ReactNode;
  notices?: ReactNode;
  action?: ReactNode;
  dock?: ReactNode;
  nav?: ReactNode;
  children?: ReactNode;
};

/**
 * Frontier's HUD on a phone (owner, 22 October 2026: mobile direction A, the map first). Held upright, in bands: the
 * strip and Next up on top, the map in the middle, and the foot read upward from the place bar: the dock, the action
 * row, the notices. Held sideways, the places stand in a rail at the left and the rest in one column at the right, the
 * map between them. A nav page (Research, the Log, Chat, the season) stands where the action row and the dock stood, and
 * the map stays clear of it; a sheet stands in the same place (`--hud-phone-foot` upright, `--hud-sheet-top` sideways,
 * which hud-sheet.css reads), as tall as what it holds up to the phone panel's height. While either is open, the action
 * row and the dock step aside under it and Next up's row folds away, so the map keeps what they took (owner, 26 October
 * 2026: layout A); the notices stay. A page that marks itself `data-page-fills` (Chat) takes the whole band from the strip
 * to the place bar, the map hidden behind it: a page read and written in, not glanced at over the map. The page says
 * so itself, so wherever it is drawn (the game, the lab) it stands the same. A desktop has the HUD every mode shares (FrontierDesktop).
 */
export const HudBands = (bands: Bands) => (useSideways() ? <SidewaysBands {...bands} /> : <UprightBands {...bands} />);

const UprightBands = ({ strip, purse, page, nextUp, notices, action, dock, nav, children }: Bands) => {
  const bar = useRef<HTMLDivElement>(null);
  // A sheet stands on the place bar: its top, from the screen's bottom.
  const foot = useEdge(bar, (rect) => window.innerHeight - rect.top + BAND_GAP);
  return (
    <div
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-[var(--keyboard,0px)] z-30 flex flex-col gap-1.5 font-sans [&:has([data-kit-sheet])_[data-under-sheet]]:hidden [&:has([data-kit-sheet],[data-page])_[data-top-row]]:hidden [&:has([data-page-fills])_[data-map-band]]:hidden"
      style={{ ...SAFE_AREA, "--hud-phone-foot": `${foot}px` } as CSSProperties}
    >
      <div {...HUD_TOP_MARK} className="flex flex-col gap-1.5">
        <div className="relative">{strip}</div>
        <TopRow nextUp={nextUp} purse={purse} />
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
        <div ref={bar} data-keyboard-hides>
          {nav}
        </div>
      </div>
      {children}
    </div>
  );
};

const SidewaysBands = ({ strip, purse, page, nextUp, notices, action, dock, nav, children }: Bands) => {
  const top = useRef<HTMLDivElement>(null);
  // A sheet stands in the column under the strip and Next up.
  const sheetTop = useEdge(top, (rect) => rect.bottom + BAND_GAP);
  return (
    <div
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-[var(--keyboard,0px)] z-30 flex gap-1.5 font-sans [&:has([data-kit-sheet])_[data-under-sheet]]:hidden [&:has([data-kit-sheet],[data-page])_[data-top-row]]:hidden"
      style={{ ...SAFE_AREA, "--hud-sheet-top": `${sheetTop}px` } as CSSProperties}
    >
      <div {...HUD_COLUMN_MARK} className="flex">
        {nav}
      </div>
      <div className="relative min-w-0 flex-1" />
      <div {...HUD_COLUMN_MARK} className="flex min-h-0 w-hud-column flex-col gap-1.5">
        <div ref={top} className="flex flex-col gap-1.5">
          <div className="relative">{strip}</div>
          <TopRow nextUp={nextUp} purse={purse} />
        </div>
        <div className="flex flex-col gap-1.5">{notices}</div>
        {page ? <PageBand className="flex-1">{page}</PageBand> : <UnderSheet action={action} dock={dock} />}
      </div>
      {children}
    </div>
  );
};

/** Under the strip: Next up's line, and the purse at its right; folded away while a sheet or a page is open. */
const TopRow = ({ nextUp, purse }: { nextUp: ReactNode; purse: ReactNode }) => (
  <div data-top-row className="flex items-start gap-1.5">
    <div data-next-up className="min-w-0 flex-1">
      {nextUp}
    </div>
    {purse}
  </div>
);

/** A nav page's place: as tall as its band gives, scrolling inside. */
const PageBand = ({ className, children }: { className: string; children: ReactNode }) => (
  <div data-page className={`flex min-h-0 flex-col ${className}`}>
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <OpenedFromPanel.Provider value>{children}</OpenedFromPanel.Provider>
    </div>
  </div>
);

/** The action row and the dock, at the band's foot; a sheet stands over them and they step aside. */
const UnderSheet = ({ action, dock }: { action: ReactNode; dock: ReactNode }) => (
  <div data-under-sheet className="mt-auto flex flex-col gap-1.5">
    {action}
    <div>{dock}</div>
  </div>
);

/** An edge of an element on screen, read again whenever the element or the screen changes size. */
const useEdge = (ref: RefObject<HTMLElement>, edge: (rect: DOMRect) => number) => {
  const [value, setValue] = useState(0);
  const read = useRef(edge);
  read.current = edge;
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
  }, [ref]);
  return value;
};
