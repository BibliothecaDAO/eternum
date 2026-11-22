import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { SecondaryMenuItems } from "@/ui/features/world";
import { IdentityChip, type SeasonGoal } from "@/ui/features/world/containers/top-header/identity-chip";
import { MapViewControls, type WorldTab } from "@/ui/features/world/containers/top-header/map-view-controls";
import { useTopBarNavigation } from "@/ui/features/world/containers/top-header/use-top-bar-navigation";
import { memo, type ReactNode } from "react";

export const FrontierTopBar = memo(
  ({
    season,
    places,
    worldTab,
    depthSwitch,
    clock,
  }: {
    season?: SeasonGoal;
    places?: ReactNode;
    worldTab?: WorldTab;
    depthSwitch?: ReactNode;
    clock: ReactNode;
  }) => {
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
        <header aria-label="Game controls" className="ui-frontier-topbar">
          <div className="ui-frontier-topbar__group">
            <IdentityChip season={season} />
            {places}
          </div>
          <div className="ui-frontier-topbar__group">
            <MapViewControls
              compact={false}
              isLocalView={isLocalView}
              canOpenLocal={canOpenLocal}
              mapLayer={mapLayer}
              showLayerSwitch={showLayerSwitch}
              worldTab={worldTab}
              onNavigate={navigateToView}
              onLayerChange={switchLayer}
            />
            {depthSwitch}
            {clock}
            <SecondaryMenuItems />
          </div>
        </header>

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
  },
);

FrontierTopBar.displayName = "FrontierTopBar";
