import { SpectatorStandings } from "./spectator-standings";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_COLUMN_TOP, HUD_COLUMN_WIDTH } from "./hud-layout";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { EmpireCockpit } from "@/ui/features/world/containers/left-facets/empire-cockpit";
import { StructureActionsPanel } from "@/ui/features/world/containers/left-facets/structure-actions-panel";
import { StructureListColumn } from "@/ui/features/world/containers/left-facets/structure-list-column";
import { MINIMAP_SIZE } from "@/ui/features/world/components/bottom-right-panel/constants";
import { memo } from "react";

/**
 * The column stops above the minimap panel (the map, its title row and its margin, plus a gap), so nothing in it hides
 * under the minimap; what does not fit scrolls (no panel shrinks to fit), the action strip pinned above it at its foot.
 */
const SIDEBAR_MAX_HEIGHT = `calc(100vh - 60px - ${MINIMAP_SIZE}px - 28px)`;

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
        "fixed left-3 z-20 pointer-events-auto flex flex-col gap-3 overflow-y-auto scrollbar-thin [&>*]:shrink-0",
        HUD_COLUMN_TOP,
        HUD_COLUMN_WIDTH,
      )}
      style={{ maxHeight: SIDEBAR_MAX_HEIGHT }}
    >
      <StructureListColumn />
      <EmpireCockpit />
      <div className="sticky bottom-0 z-10 rounded-xl bg-kit-ground">
        <StructureActionsPanel />
      </div>
    </div>
  );
});

LeftCommandSidebar.displayName = "LeftCommandSidebar";
