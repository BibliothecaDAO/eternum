import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { HUD_FOOT_MARK, HUD_TOP_MARK } from "@/three/utils/labels/hud-clearance";
import { OpenedFromPanel } from "@/ui/design-system/kit/opened-from-panel";

const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/** The bands' gap (gap-1.5), kept between the place bar and a sheet standing on it. */
const BAND_GAP = 6;

/**
 * Frontier's HUD on a phone, in bands (owner, 22 October 2026: mobile direction A, the map first): the strip and Next up
 * on top, the map in the middle, and the foot read upward from the place bar: the dock, the action row, the notices.
 * A nav page (Research, the Log, Chat, the season) rises from the place bar to at most half the screen and the map
 * stays above it; a sheet stands in the same place (`--hud-phone-foot`, the place bar's top). While either is open, the
 * action row and the dock step aside under it; the notices stay. A desktop has the HUD every mode shares
 * (FrontierDesktop).
 */
export const HudBands = ({
  strip,
  stage,
  page,
  nextUp,
  notices,
  action,
  dock,
  nav,
  children,
}: {
  strip: ReactNode;
  /** What floats over the map itself (the last hour's bubble). */
  stage?: ReactNode;
  /** A nav page, standing on the place bar. */
  page?: ReactNode;
  nextUp?: ReactNode;
  notices?: ReactNode;
  action?: ReactNode;
  dock?: ReactNode;
  nav?: ReactNode;
  children?: ReactNode;
}) => {
  const { ref, foot } = usePlaceBarTop();
  return (
    <div
      aria-label="Frontier HUD"
      className="pointer-events-none fixed inset-0 z-30 flex flex-col gap-1.5 font-sans [&:has([data-kit-sheet])_[data-under-sheet]]:hidden"
      style={{ ...SAFE_AREA, "--hud-phone-foot": `${foot}px` } as CSSProperties}
    >
      <div {...HUD_TOP_MARK} className="flex flex-col gap-1.5">
        <div className="relative">{strip}</div>
        <div data-next-up>{nextUp}</div>
      </div>
      <div className="relative min-h-0 flex-1">{stage}</div>
      <div {...HUD_FOOT_MARK} className="flex min-h-0 flex-col gap-1.5">
        <div className="flex flex-col gap-1.5">{notices}</div>
        {page ? (
          <div data-page className="flex h-[50dvh] min-h-0 flex-col">
            <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
              <OpenedFromPanel.Provider value>{page}</OpenedFromPanel.Provider>
            </div>
          </div>
        ) : (
          <div data-under-sheet className="flex flex-col gap-1.5">
            {action}
            <div>{dock}</div>
          </div>
        )}
        <div ref={ref}>{nav}</div>
      </div>
      {children}
    </div>
  );
};

/** How far above the screen's bottom a sheet stands: the place bar's top, with the bands' gap. */
const usePlaceBarTop = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [foot, setFoot] = useState(0);
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const measure = () => setFoot(Math.round(window.innerHeight - bar.getBoundingClientRect().top + BAND_GAP));
    measure();
    // The place bar's height changes with its badges and the safe area, the screen's with its turning.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return { ref, foot };
};
