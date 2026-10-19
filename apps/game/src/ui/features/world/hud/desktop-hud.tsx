import { useAccountStore } from "@/hooks/store/use-account-store";
import { HUD_COLUMN_MARK, HUD_FOOT_MARK } from "@/three/utils/labels/hud-clearance";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { SpectatorStandingsBody } from "@/ui/features/world/containers/spectator-standings";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useGameFinished } from "@/ui/features/world/containers/top-header/game-clock";
import { ActionBubbles } from "./action-bubbles";
import { GuidedRail } from "./guided-rail";
import { HoldingsList, useHoldings } from "./holdings";
import { useHudKeys } from "./hud-keys";
import { useIdleArmies } from "./idle-armies";
import { HudMinimap } from "./minimap";
import { RealmCard } from "./realm-card";
import type { ReactNode } from "react";

/**
 * The Blitz and Eternum HUD on a desktop, beside the header:
 *
 *   - left, one column: the holdings (one kind at a time under tabs, starred first, each row with its Provision or Level
 *     up), sized to their rows; the selected holding's card (name, population, tiles, automation, resources, relics);
 *     the minimap pinned to the bottom-left corner, a square that gives way down to its least height when the column
 *     runs short. A spectator sees the standings and the minimap;
 *   - right, the guided rail: Next up, the events, the picked tile's details, chat;
 *   - the four orders as round bubbles at the foot, between the columns;
 *   - its keys (`useHudKeys`): B P M T open the workspaces, Space takes Next up's step, I selects the next idle army.
 *     They are never drawn.
 *
 * Nothing shows over the blank overlay.
 */
export const DesktopHud = () => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const idleArmies = useIdleArmies();
  useHudKeys({ idleArmies });
  if (showBlankOverlay) return null;
  return (
    <>
      <LeftColumn />
      <GuidedRail />
      <OrdersFoot />
    </>
  );
};

/** The orders as round bubbles at the foot, between the columns. */
export const OrdersFoot = () => (
  <HudFoot>
    <ActionBubbles />
  </HudFoot>
);

/**
 * The desktop HUD's left column, every mode's: from under the top bar down to the base band, its panels stacked, the
 * minimap pinned to its bottom-left corner. The map's labels keep clear of it.
 */
export const HudColumn = ({ label, children }: { label: string; children: ReactNode }) => (
  <aside
    {...HUD_COLUMN_MARK}
    aria-label={label}
    className="pointer-events-none fixed bottom-hud-base left-3 top-hud-header z-hud-column flex w-hud-column flex-col gap-2"
  >
    {children}
  </aside>
);

/** The desktop HUD's foot, every mode's: between the columns, its round orders (and what goes with them). */
export const HudFoot = ({ children }: { children: ReactNode }) => (
  <div
    {...HUD_FOOT_MARK}
    className="pointer-events-none fixed bottom-5 left-hud-foot right-hud-foot z-hud-foot flex items-end justify-center"
  >
    {children}
  </div>
);

export const LeftColumn = () => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const finished = useGameFinished();
  const account = useAccountStore((state) => state.account);
  if (ordersAllowed && !account) return null;
  return (
    <HudColumn label="Holdings">
      {ordersAllowed ? (
        <HoldingsAndCard />
      ) : (
        <HudPanel
          label="Spectator standings"
          title={finished ? "Final standings" : "Standings"}
          className="flex max-h-hud-list flex-col"
          bodyClassName="min-h-0 overflow-y-auto"
        >
          <SpectatorStandingsBody />
        </HudPanel>
      )}
      <HudMinimap className="mt-auto min-h-hud-minimap w-full shrink" />
    </HudColumn>
  );
};

const HoldingsAndCard = () => {
  const holdings = useHoldings();
  return (
    <>
      <HoldingsList holdings={holdings} />
      <RealmCard holding={holdings.selected} />
    </>
  );
};
