import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { HudHeaderLayout } from "./hud-header-layout";
import { MapViewControls, type WorldTab } from "./map-view-controls";
import { SecondaryMenuItems } from "@/ui/features/world";
import { GameClock } from "./game-clock";
import { AttentionPill } from "./attention-pill";
import { IdentityChip, type SeasonGoal } from "./identity-chip";
import { useTopBarNavigation } from "./use-top-bar-navigation";
import { memo, type ReactNode } from "react";

type TopHeaderProps = { season?: SeasonGoal; clock?: ReactNode; worldTab?: WorldTab };

/**
 * The in-game top bar every mode shares: who plays (a mode may add its season goal), the clock (a mode may bring its
 * own: Frontier's day), the realm and world views (a mode may list its layers under World: Frontier's Ethereal), and
 * settings.
 */
export const TopHeader = memo(({ season, clock, worldTab }: TopHeaderProps) => {
  const lane = useCompactLane();
  const {
    isLocalView,
    canOpenLocal,
    mapLayer,
    showLayerSwitch,
    isFollowingArmy,
    followingArmyMessage,
    navigateToView,
    switchLayer,
  } = useTopBarNavigation();

  return (
    <>
      <HudHeaderLayout
        lane={lane}
        identity={<IdentityChip compact={lane !== null} season={season} />}
        clock={clock ?? <GameClock compact={lane !== null} />}
        // On a desktop Next up, atop the rail, is the one queue of what needs the player (the owner's ruling, 16
        // October 2026); the phone, which has no Next up yet, keeps the pill.
        attention={lane ? <AttentionPill /> : null}
        settings={<SecondaryMenuItems />}
        viewControls={
          <MapViewControls
            compact={lane !== null}
            isLocalView={isLocalView}
            canOpenLocal={canOpenLocal}
            mapLayer={mapLayer}
            showLayerSwitch={showLayerSwitch}
            worldTab={worldTab}
            onNavigate={navigateToView}
            onLayerChange={switchLayer}
          />
        }
      />

      {/* What the camera follows: read, never pressed, so the map under it stays playable. */}
      {isFollowingArmy && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2">
          <HudPill>
            {[
              <span key="following" className="flex items-center gap-2">
                <SemanticIcon
                  name={followingArmyMessage?.toLowerCase().includes("combat") ? "military" : "eye"}
                  className="h-4 w-4 animate-pulse"
                />
                {followingArmyMessage ?? "Following Army"}
              </span>,
            ]}
          </HudPill>
        </div>
      )}
    </>
  );
});

TopHeader.displayName = "TopHeader";
