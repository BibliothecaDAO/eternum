import type { CSSProperties, ReactNode } from "react";

const SAFE_AREA: CSSProperties = {
  paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
  paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
  paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
  paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
};

/**
 * The HUD's slots over the stage, in two compositions of the same parts. On a phone, three bands: the strip on top,
 * the map (or a nav page) in the middle, and the foot rows read upward from the nav: the dock, the action bar, the
 * notices, the guide. On desktop, the corners: the strip top left with the armies down the left, the nav top right
 * with the season's top five under it, a nav page or a sheet as the right panel, the action bar and notices bottom
 * centre, and chat docked bottom left with the guide above it, beside the armies' column so a long dock never covers
 * it. Sheets and moments render beside the slots and place themselves. While a sheet is open the guide and the
 * season's peek wait out of its way.
 */
export const HudBands = ({
  strip,
  stage,
  page,
  guide,
  notices,
  action,
  dock,
  nav,
  peek,
  chat,
  children,
}: {
  strip: ReactNode;
  /** What floats over the map itself (the last hour's bubble). */
  stage?: ReactNode;
  /** A nav page: the middle band on a phone, the right panel on desktop. */
  page?: ReactNode;
  guide?: ReactNode;
  notices?: ReactNode;
  action?: ReactNode;
  dock?: ReactNode;
  nav?: ReactNode;
  /** Desktop only: the season's top five under the nav, while no panel is open. */
  peek?: ReactNode;
  /** Desktop only: chat docked open. */
  chat?: ReactNode;
  children?: ReactNode;
}) => (
  <div
    aria-label="Frontier HUD"
    className="pointer-events-none fixed inset-0 z-30 flex flex-col gap-1.5 font-sans lg:block [&:has([data-kit-sheet])_[data-guide]]:hidden [&:has([data-kit-sheet])_[data-peek]]:hidden"
    style={SAFE_AREA}
  >
    <div className="lg:absolute lg:left-2 lg:top-2 lg:w-[560px]">{strip}</div>
    {page ? (
      <div className="flex min-h-0 flex-1 flex-col lg:absolute lg:bottom-2 lg:right-2 lg:top-[76px] lg:w-[440px]">
        {page}
      </div>
    ) : (
      <div className="relative min-h-0 flex-1 lg:absolute lg:inset-x-[240px] lg:bottom-[140px] lg:top-[150px]">
        {stage}
      </div>
    )}
    <div data-guide className="lg:absolute lg:bottom-[300px] lg:left-[236px] lg:w-[380px]">
      {guide}
    </div>
    <div className="flex flex-col gap-1.5 lg:absolute lg:bottom-2 lg:left-1/2 lg:w-[520px] lg:-translate-x-1/2">
      {notices}
      {action}
    </div>
    <div className="lg:absolute lg:left-2 lg:top-[150px] lg:w-[220px]">{dock}</div>
    <div className="lg:absolute lg:right-2 lg:top-2 lg:w-[460px]">{nav}</div>
    {peek && !page && (
      <div data-peek className="hidden lg:absolute lg:right-2 lg:top-[76px] lg:block lg:w-[340px]">
        {peek}
      </div>
    )}
    {chat && <div className="hidden lg:absolute lg:bottom-2 lg:left-2 lg:block lg:w-[380px]">{chat}</div>}
    {children}
  </div>
);
