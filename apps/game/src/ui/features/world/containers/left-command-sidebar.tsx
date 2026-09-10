import { SpectatorStandings } from "./spectator-standings";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_COLUMN_TOP, HUD_COLUMN_WIDTH } from "./hud-layout";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { EmpireCockpit } from "@/ui/features/world/containers/left-facets/empire-cockpit";
import { StructureActionsPanel } from "@/ui/features/world/containers/left-facets/structure-actions-panel";
import { StructureListColumn } from "@/ui/features/world/containers/left-facets/structure-list-column";
import { memo } from "react";

/**
 * The desktop left column: the player's structures, the active one's actions bubble, then its token panel, or the
 * standings for a spectator. The Build / Logistics / Military surfaces are `LeftViewSurfaces`, mounted on every
 * layout.
 */
export const LeftCommandSidebar = memo(() => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const ConnectedAccount = useAccountStore((state) => state.account);

  if (!ordersAllowed) return <SpectatorStandings />;
  if (!ConnectedAccount) return null;

  return (
    <div
      className={cn(
        "fixed left-3 z-20 pointer-events-auto flex max-h-[calc(100vh-340px)] flex-col gap-2 overflow-y-auto scrollbar-thin",
        HUD_COLUMN_TOP,
        HUD_COLUMN_WIDTH,
      )}
    >
      <StructureListColumn />
      <EmpireCockpit />
      <StructureActionsPanel />
    </div>
  );
});

LeftCommandSidebar.displayName = "LeftCommandSidebar";
