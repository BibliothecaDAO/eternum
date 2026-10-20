import type { CSSProperties, ReactNode } from "react";

import { OpenedFromPanel } from "@/ui/design-system/kit/opened-from-panel";

const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/**
 * Frontier's HUD on a phone, in three bands: the strip on top, the map (or a nav page) in the middle, and the foot rows
 * read upward from the nav: the dock, the action bar, the notices, Next up. A docked sheet hides Next up. Sheets
 * and moments render beside the bands and place themselves. A desktop has the HUD every mode shares
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
  /** A nav page: the middle band. */
  page?: ReactNode;
  nextUp?: ReactNode;
  notices?: ReactNode;
  action?: ReactNode;
  dock?: ReactNode;
  nav?: ReactNode;
  children?: ReactNode;
}) => (
  <div
    aria-label="Frontier HUD"
    className="pointer-events-none fixed inset-0 z-30 flex flex-col gap-1.5 font-sans [&:has([data-kit-sheet])_[data-next-up]]:hidden"
    style={SAFE_AREA}
  >
    <div className="relative">{strip}</div>
    {page ? (
      <div data-page className="flex min-h-0 flex-1 flex-col">
        <OpenedFromPanel.Provider value>{page}</OpenedFromPanel.Provider>
      </div>
    ) : (
      <div className="relative min-h-0 flex-1">{stage}</div>
    )}
    <div data-next-up>{nextUp}</div>
    <div className="flex flex-col gap-1.5">
      {notices}
      {action}
    </div>
    <div>{dock}</div>
    <div>{nav}</div>
    {children}
  </div>
);
