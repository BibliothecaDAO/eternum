import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";

import { useKeyboardHeight } from "@/hooks/use-keyboard-inset";
import { useHudSideways, useHudTablet } from "@/hooks/helpers/use-compact-hud";
import { HUD_COLUMN_MARK, HUD_FOOT_MARK, HUD_TOP_MARK } from "@/three/utils/labels/hud-clearance";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";

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
  page?: ReactNode;
  notices?: ReactNode;
  action?: ReactNode;
  dock?: ReactNode;
  nav?: ReactNode;
  children?: ReactNode;
};

export const HudBands = (bands: Bands) =>
  useHudSideways() ? <SidewaysBands {...bands} /> : <UprightBands {...bands} />;

const UprightBands = ({ strip, page, notices, action, dock, nav, children }: Bands) => {
  const bar = useRef<HTMLDivElement>(null);
  const foot = useEdge(bar, (rect) => window.innerHeight - rect.top + BAND_GAP);
  const topBand = useRef<HTMLDivElement>(null);
  const top = useEdge(topBand, (rect) => rect.bottom + BAND_GAP);
  const [sheetBand, setSheetBand] = useState<HTMLDivElement | null>(null);
  const tablet = useHudTablet();
  return (
    <div
      data-hud-form={tablet ? "tablet" : "phone"}
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-hud-keyboard z-30 flex flex-col gap-1.5 font-sans [&:has([data-kit-sheet])_[data-under-sheet]]:hidden [&:has([data-page-fills])_:is([data-map-band],[data-map-cluster])]:hidden [html[data-keyboard]_&:has([data-page])_[data-map-band]]:hidden"
      style={{ ...SAFE_AREA, "--hud-phone-foot": `${foot}px`, "--hud-phone-top": `${top}px` } as CSSProperties}
    >
      <div ref={topBand} {...HUD_TOP_MARK} data-keyboard-hides className="flex flex-col gap-1.5">
        <div className="relative">{strip}</div>
      </div>
      <div data-map-band className="relative min-h-0 flex-1" />
      <div
        {...HUD_FOOT_MARK}
        className="flex min-h-0 flex-col gap-1.5 [&:has([data-page-fills])]:flex-1 [html[data-keyboard]_&:has([data-page])]:flex-1"
      >
        <div className="flex flex-col gap-1.5">{notices}</div>
        <div ref={setSheetBand} data-sheet-band className="flex min-h-0 flex-col empty:hidden" />
        {page ? (
          <PageBand className="mt-auto max-h-hud-phone-sheet [&:has([data-page-fills])]:max-h-hud-phone-browse [&:has([data-page-fills])]:flex-1 [html[data-keyboard]_&]:max-h-none [html[data-keyboard]_&]:flex-1">
            {page}
          </PageBand>
        ) : (
          <UnderSheet action={action} dock={dock} />
        )}
        <div ref={bar}>
          <div data-keyboard-hides>{nav}</div>
        </div>
      </div>
      <SheetDock.Provider value={sheetBand}>{children}</SheetDock.Provider>
    </div>
  );
};

const SidewaysBands = ({ strip, page, notices, action, dock, nav, children }: Bands) => {
  const top = useRef<HTMLDivElement>(null);
  const sheetTop = useEdge(top, (rect) => rect.bottom + BAND_GAP);
  return (
    <div
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-hud-keyboard z-30 flex gap-1.5 font-sans [&:has([data-kit-sheet])_[data-under-sheet]]:hidden [&:has([data-page-fills])_[data-map-cluster]]:hidden"
      style={{ ...SAFE_AREA, "--hud-sheet-top": `${sheetTop}px` } as CSSProperties}
    >
      <div {...HUD_COLUMN_MARK} data-side-rail className="flex">
        {nav}
      </div>
      <div className="relative min-w-0 flex-1" />
      <div {...HUD_COLUMN_MARK} className="flex min-h-0 w-hud-column flex-col gap-1.5">
        <div ref={top} data-keyboard-hides className="flex flex-col gap-1.5">
          <div className="relative">{strip}</div>
        </div>
        <div className="flex flex-col gap-1.5">{notices}</div>
        {page ? <PageBand className="flex-1">{page}</PageBand> : <UnderSheet action={action} dock={dock} />}
      </div>
      {children}
    </div>
  );
};

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
