import { useAccountStore } from "@/hooks/store/use-account-store";
import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SpectatorStandingsBody } from "@/ui/features/world/containers/spectator-standings";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ActionBubbles } from "./action-bubbles";
import { GuidedRail } from "./guided-rail";
import { HoldingsList, useHoldings } from "./holdings";
import { HUD_PANEL } from "./hud-panel";
import { useHudKeys } from "./hud-keys";
import { IdleArmiesButton, useIdleArmies } from "./idle-armies";
import { HudMinimap } from "./minimap";
import { RealmCard } from "./realm-card";

/**
 * The Blitz and Eternum HUD on a desktop, beside the header:
 *
 *   - left, one column: the holdings (one kind at a time under tabs, starred first, each row with its Provision or Level
 *     up), sized to their rows; the selected holding's card (name, population, tiles, automation, resources, relics);
 *     the minimap in the rest. A spectator sees the standings and the minimap;
 *   - right, the guided rail: Next up, the events, the picked tile's details, chat;
 *   - the four orders as round bubbles at the foot, between the columns, with Idle armies beside them for a player;
 *   - its keys (`useHudKeys`): B P M T open the workspaces, Space takes Next up's step, I selects the next idle army.
 *     They are never drawn.
 *
 * Nothing shows over the blank overlay.
 */
export const DesktopHud = () => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const ordersAllowed = useUIStore(canIssueOrders);
  const idleArmies = useIdleArmies();
  useHudKeys({ idleArmies });
  if (showBlankOverlay) return null;
  return (
    <>
      <LeftColumn />
      <GuidedRail />
      <div className="pointer-events-none fixed bottom-5 left-[344px] right-[344px] z-[26] flex items-end justify-center gap-4">
        <ActionBubbles />
        {ordersAllowed && <IdleArmiesButton idle={idleArmies} className="mb-7" />}
      </div>
    </>
  );
};

const LeftColumn = () => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const account = useAccountStore((state) => state.account);
  if (ordersAllowed && !account) return null;
  return (
    <aside
      {...HUD_COLUMN_MARK}
      aria-label="Holdings"
      className="pointer-events-none fixed bottom-4 left-3 top-[60px] z-20 flex w-[320px] flex-col gap-2"
    >
      {ordersAllowed ? (
        <HoldingsAndCard />
      ) : (
        <section aria-label="Spectator standings" className={cn(HUD_PANEL, "max-h-[40vh] overflow-y-auto p-0")}>
          <SpectatorStandingsBody />
        </section>
      )}
      <HudMinimap className="min-h-[200px] w-full flex-1" />
    </aside>
  );
};

const HoldingsAndCard = () => {
  const holdings = useHoldings();
  return (
    <>
      <HoldingsList holdings={holdings} />
      <div className={cn(HUD_PANEL, "flex min-h-0 shrink-0 flex-col overflow-y-auto scrollbar-thin")}>
        <RealmCard holding={holdings.selected} />
      </div>
    </>
  );
};
