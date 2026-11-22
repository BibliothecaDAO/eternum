import { SecondaryMenuItems } from "@/ui/features/world";
import { FollowingArmyPill } from "@/ui/features/world/containers/top-header/following-army-pill";
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
    const { isLocalView, canOpenLocal, mapLayer, showLayerSwitch, navigateToView, switchLayer } = useTopBarNavigation();

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
        <FollowingArmyPill />
      </>
    );
  },
);

FrontierTopBar.displayName = "FrontierTopBar";
