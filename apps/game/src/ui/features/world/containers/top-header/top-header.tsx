import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { HudHeaderLayout } from "./hud-header-layout";
import { MapViewControls } from "./map-view-controls";
import { SecondaryMenuItems } from "@/ui/features/world";
import { GameClock } from "./game-clock";
import { AttentionPill } from "./attention-pill";
import { FollowingArmyPill } from "./following-army-pill";
import { IdentityChip, type SeasonGoal } from "./identity-chip";
import { useTopBarNavigation } from "./use-top-bar-navigation";
import { memo, type ReactNode } from "react";

type TopHeaderProps = {
  identity?: ReactNode;
  season?: SeasonGoal;
  places?: ReactNode;
  quest?: ReactNode;
  stores?: ReactNode;
  depthSwitch?: ReactNode;
  clock?: ReactNode;
};

export const TopHeader = memo(({ identity, season, places, quest, stores, depthSwitch, clock }: TopHeaderProps) => {
  const lane = useCompactLane();
  const { isLocalView, canOpenLocal, mapLayer, showLayerSwitch, navigateToView, switchLayer } = useTopBarNavigation();

  return (
    <>
      <HudHeaderLayout
        lane={lane}
        identity={identity ?? <IdentityChip season={season} compact={lane !== null} />}
        places={places}
        quest={quest}
        stores={stores}
        depthSwitch={depthSwitch}
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
            onNavigate={navigateToView}
            onLayerChange={switchLayer}
          />
        }
      />
      <FollowingArmyPill />
    </>
  );
});

TopHeader.displayName = "TopHeader";
