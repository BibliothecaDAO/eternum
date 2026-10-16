import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SpectatorStandings } from "@/ui/features/world/containers/spectator-standings";
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
 *   - left, the holdings: one kind at a time under tabs, starred first, each row with its Provision or Level up; the
 *     selected holding's card (name, population, tiles, automation, resources, relics); a tall minimap;
 *   - right, the guided rail: Next up, the event log, the picked tile's details, chat;
 *   - the four orders as round bubbles at the foot, between the columns;
 *   - its keys (`useHudKeys`): B P M T open the workspaces, Space takes Next up's step, I selects the next idle army,
 *     which the minimap's Idle armies button also does.
 *
 * A spectator sees the standings in place of the holdings. Nothing shows over the blank overlay.
 */
export const DesktopHud = () => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const idleArmies = useIdleArmies();
  useHudKeys({ idleArmies });
  if (showBlankOverlay) return null;
  return (
    <>
      <HoldingsColumn idleArmies={idleArmies} />
      <GuidedRail />
      <ActionBubbles className="fixed bottom-5 left-[344px] right-[344px] z-[26]" />
    </>
  );
};

const HoldingsColumn = ({ idleArmies }: { idleArmies: readonly number[] }) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const account = useAccountStore((state) => state.account);
  if (!ordersAllowed) return <SpectatorStandings />;
  if (!account) return null;
  return (
    <aside
      aria-label="Holdings"
      className="pointer-events-none fixed bottom-4 left-3 top-[60px] z-20 flex w-[320px] flex-col gap-2"
    >
      <HoldingsAndCard />
      <div className="relative h-[216px] w-full shrink-0">
        <HudMinimap className="h-full w-full" />
        <IdleArmiesButton idle={idleArmies} className="absolute right-2 top-2" />
      </div>
    </aside>
  );
};

const HoldingsAndCard = () => {
  const holdings = useHoldings();
  return (
    <>
      <HoldingsList holdings={holdings} />
      <div className={cn(HUD_PANEL, "flex min-h-0 shrink flex-col overflow-y-auto scrollbar-thin")}>
        <RealmCard holding={holdings.selected} />
      </div>
    </>
  );
};
