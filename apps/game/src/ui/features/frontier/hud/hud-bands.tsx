import type { CSSProperties, ReactNode } from "react";

import { OpenedFromPanel } from "@/ui/design-system/kit/opened-from-panel";

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
 * with a nav page or a sheet as the right panel under it (the season's board is one, opened from the Menu), the action
 * bar and notices bottom centre, and chat docked bottom left with the guide above it, beside the armies' column so a
 * long dock never covers it. A nav page is as tall as its content. Sheets and moments render beside the slots and
 * place themselves; a desktop sheet docks where the page stands, so while one is open the guide and the page wait out
 * of its way (a sheet opened from the page takes the page's place).
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
  /** Desktop only: chat docked open. */
  chat?: ReactNode;
  children?: ReactNode;
}) => (
  <div
    aria-label="Frontier HUD"
    className="pointer-events-none fixed inset-0 z-30 flex flex-col gap-1.5 font-sans lg:block [&:has([data-kit-sheet])_[data-guide]]:hidden lg:[&:has([data-kit-sheet])_[data-page]]:invisible"
    style={SAFE_AREA}
  >
    <div className="relative lg:absolute lg:left-2 lg:top-2 lg:w-hud-frontier-strip">{strip}</div>
    {page ? (
      <div
        data-page
        className="flex min-h-0 flex-1 flex-col lg:absolute lg:right-2 lg:top-hud-frontier-page-top lg:max-h-hud-frontier-page-room lg:w-hud-frontier-page"
      >
        <OpenedFromPanel.Provider value>{page}</OpenedFromPanel.Provider>
      </div>
    ) : (
      <div className="relative min-h-0 flex-1 lg:absolute lg:inset-x-60 lg:bottom-hud-frontier-stage-bottom lg:top-hud-frontier-stage-top">
        {stage}
      </div>
    )}
    <div
      data-guide
      className="lg:absolute lg:bottom-hud-frontier-guide-bottom lg:left-hud-frontier-guide-left lg:w-hud-frontier-guide"
    >
      {guide}
    </div>
    <div className="flex flex-col gap-1.5 lg:absolute lg:bottom-2 lg:left-1/2 lg:w-hud-frontier-foot lg:-translate-x-1/2">
      {notices}
      {action}
    </div>
    <div className="lg:absolute lg:left-2 lg:top-hud-frontier-stage-top lg:w-hud-frontier-dock">{dock}</div>
    <div className="lg:absolute lg:right-2 lg:top-2 lg:w-hud-frontier-nav">{nav}</div>
    {chat && <div className="hidden lg:absolute lg:bottom-2 lg:left-2 lg:block lg:w-hud-frontier-chat">{chat}</div>}
    {children}
  </div>
);
