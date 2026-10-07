import type { CSSProperties, ReactNode } from "react";

const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/**
 * The phone's three bands over the stage: the strip on top, the map (or a nav page) in the middle, and the foot rows,
 * read upward from the nav: the dock, the action bar, a notice, the guide. Sheets and moments render beside the bands
 * and place themselves. While a sheet is open the guide waits out of its way.
 */
export const HudBands = ({
  top,
  middle,
  foot,
  children,
}: {
  top: ReactNode;
  /** A nav page; the map shows through when there is none. */
  middle?: ReactNode;
  foot: ReactNode;
  children?: ReactNode;
}) => (
  <div
    aria-label="Frontier HUD"
    className="pointer-events-none fixed inset-0 z-30 flex flex-col gap-1.5 font-sans [&:has([data-kit-sheet])_[data-guide]]:hidden"
    style={SAFE_AREA}
  >
    {top}
    {middle ?? <div className="min-h-0 flex-1" />}
    {foot}
    {children}
  </div>
);
