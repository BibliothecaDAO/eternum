import { useAccountStore } from "@/hooks/store/use-account-store";
import { HUD_COLUMN_MARK, HUD_FOOT_MARK } from "@/three/utils/labels/hud-clearance";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { SpectatorStandingsBody } from "@/ui/features/world/containers/spectator-standings";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ActionBubbles } from "./action-bubbles";
import { GuidedRail } from "./guided-rail";
import { HoldingsList, useHoldings } from "./holdings";
import { useHudKeys } from "./hud-keys";
import { type IdleArmies, IdleArmiesButton, useIdleArmies } from "./idle-armies";
import { HudMinimap } from "./minimap";
import { RealmCard } from "./realm-card";

/**
 * The Blitz and Eternum HUD on a desktop, beside the header:
 *
 *   - left, one column: the holdings (one kind at a time under tabs, starred first, each row with its Provision or Level
 *     up), sized to their rows; the selected holding's card (name, population, tiles, automation, resources, relics);
 *     the minimap pinned to the bottom-left corner, a square that gives way down to its least height when the column
 *     runs short. A spectator sees the standings and the minimap;
 *   - right, the guided rail: Next up, the events, the picked tile's details, chat;
 *   - the four orders as round bubbles at the foot, between the columns, with Idle armies beside them for a player, or
 *     above them where the room between the columns is too narrow for both;
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
      <HudFoot idleArmies={idleArmies} />
    </>
  );
};

/** The orders as round bubbles at the foot, between the columns; Idle armies beside them, or above when there is no room. */
export const HudFoot = ({ idleArmies }: { idleArmies: IdleArmies }) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  return (
    <div
      {...HUD_FOOT_MARK}
      className="pointer-events-none fixed bottom-5 left-hud-foot right-hud-foot z-hud-foot flex flex-wrap-reverse items-end justify-center gap-4"
    >
      <ActionBubbles />
      {ordersAllowed && <IdleArmiesButton idle={idleArmies} className="mb-7" />}
    </div>
  );
};

export const LeftColumn = () => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const account = useAccountStore((state) => state.account);
  if (ordersAllowed && !account) return null;
  return (
    <aside
      {...HUD_COLUMN_MARK}
      aria-label="Holdings"
      className="pointer-events-none fixed bottom-hud-base left-3 top-hud-header z-hud-column flex w-hud-column flex-col gap-2"
    >
      {ordersAllowed ? (
        <HoldingsAndCard />
      ) : (
        <HudPanel
          label="Spectator standings"
          title="Standings"
          className="flex max-h-hud-list flex-col"
          bodyClassName="min-h-0 overflow-y-auto"
        >
          <SpectatorStandingsBody />
        </HudPanel>
      )}
      <HudMinimap className="mt-auto min-h-hud-minimap w-full shrink" />
    </aside>
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
