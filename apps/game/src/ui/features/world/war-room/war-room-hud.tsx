import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ActionInfo } from "@/ui/features/world/components/actions/action-info";
import { MinimapPanel, useSelectedTileDetails } from "@/ui/features/world/components/selection-panels";
import { MINIMAP_SIZE } from "@/ui/features/world/components/selection-panels/constants";
import { CompactHud } from "@/ui/features/world/containers/compact-hud";
import { HUD_COLUMN_TOP, HUD_COLUMN_WIDTH } from "@/ui/features/world/containers/hud-layout";
import { RightHudColumn } from "@/ui/features/world/containers/right-hud-column";
import { SpectatorStandings } from "@/ui/features/world/containers/spectator-standings";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { RealmCard } from "./realm-card";
import { RealmRows, useRealmList } from "./realm-rows";

/** The left column stops above the minimap: header row and gutter, the minimap, and their two gaps. */
const REALM_COLUMN_MAX_HEIGHT = `calc(100vh - 60px - ${MINIMAP_SIZE}px - 28px)`;

/**
 * War room, the HUD of every shared-HUD mode (Blitz and Eternum). The match on top; your realms and the selected
 * one's card on the left over the minimap; Next up, the latest events, the selected tile and chat on the right.
 * Below `lg` the same cards stack into CompactHud's tabs.
 */
export const WarRoomHud = () => {
  const lane = useCompactLane();
  return (
    <>
      {/* The hovered order's costs. */}
      <ActionInfo />
      <TopHeader />
      {lane ? <CompactHud lane={lane} /> : <WarRoomColumns />}
    </>
  );
};

const WarRoomColumns = () => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const tileDetails = useSelectedTileDetails();
  if (showBlankOverlay) return null;
  return (
    <>
      <RealmColumn />
      <div className={cn("fixed bottom-4 left-3 z-[25]", HUD_COLUMN_WIDTH)}>
        <MinimapPanel />
      </div>
      <RightHudColumn>{tileDetails}</RightHudColumn>
    </>
  );
};

/** The player's realms and the selected one's card, or the standings for a spectator. */
const RealmColumn = () => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const account = useAccountStore((state) => state.account);
  const list = useRealmList();
  if (!ordersAllowed) return <SpectatorStandings />;
  if (!account || list.realms.length === 0) return null;
  return (
    <aside
      aria-label="Your realms"
      className={cn(
        "pointer-events-auto fixed left-3 z-20 space-y-3 overflow-y-auto overscroll-contain rounded-xl p-3 scrollbar-thin",
        OVERLAY_SURFACE_BASE,
        HUD_COLUMN_TOP,
        HUD_COLUMN_WIDTH,
      )}
      style={{ maxHeight: REALM_COLUMN_MAX_HEIGHT }}
    >
      <RealmRows list={list} />
      {list.selected && (
        <div className="border-t border-gold/20 pt-3">
          <RealmCard realm={list.selected} />
        </div>
      )}
    </aside>
  );
};
