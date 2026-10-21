import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { HudHeaderLayout } from "./hud-header-layout";
import { MapViewControls } from "./map-view-controls";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@bibliothecadao/eternum";

import { useUISound } from "@/audio/hooks/useUISound";
import { SecondaryMenuItems } from "@/ui/features/world";
import { GameClock } from "./game-clock";
import { AttentionPill } from "./attention-pill";
import { IdentityChip, type SeasonGoal } from "./identity-chip";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

/**
 * The in-game top bar every mode shares: who plays (a mode may add its season goal), the clock (a mode may bring its
 * own: Frontier's day), the realm and world views, and settings.
 */
export const TopHeader = memo(({ season, clock }: { season?: SeasonGoal; clock?: ReactNode }) => {
  const lane = useCompactLane();
  const { setup } = useGame();

  const playClick = useUISound("ui.click");

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const lastControlledStructureEntityId = useUIStore((state) => state.lastControlledStructureEntityId);
  const mode = useGameModeConfig();

  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  // Read again when the structure's facts arrive.
  const structures = useNativeFacts(["Structure"]);
  const entityInfo = useMemo(
    // Only the position is read here, so no viewer is needed.
    () => mode.structure.getEntityInfo(structureEntityId, null, structures.store),
    [structureEntityId, structures, mode],
  );

  // With nothing selected there is no structure to open: LOCAL is disabled rather than aimed at a default hex.
  const selectedStructurePosition = useMemo(
    () => (entityInfo?.position ? Position.fromContract(entityInfo.position) : null),
    [entityInfo],
  );
  const [currentPathname, setCurrentPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/play/hex",
  );

  const goToStructure = useGoToStructure(setup);
  const isLocalView = currentPathname.includes("/hex");
  const mapLayer = useUIStore((state) => state.mapLayer);
  const setMapLayer = useUIStore((state) => state.setMapLayer);
  // Blitz presets have no spires, so their maps have one layer.
  const showLayerSwitch = mode.id === "eternum" && !isLocalView;

  useEffect(() => {
    const updatePathname = () => {
      setCurrentPathname(window.location.pathname);
    };

    updatePathname();
    window.addEventListener("urlChanged", updatePathname);
    window.addEventListener("popstate", updatePathname);

    return () => {
      window.removeEventListener("urlChanged", updatePathname);
      window.removeEventListener("popstate", updatePathname);
    };
  }, []);

  const switchLayer = useCallback(
    (alt: boolean) => {
      if (alt === mapLayer) return;
      playClick();
      setMapLayer(alt);
    },
    [mapLayer, playClick, setMapLayer],
  );

  const navigateToView = useCallback(
    (world: boolean) => {
      if (!selectedStructurePosition) return;
      playClick();
      goToStructure(
        world ? lastControlledStructureEntityId || structureEntityId : structureEntityId,
        selectedStructurePosition,
        world,
      );
    },
    [goToStructure, lastControlledStructureEntityId, playClick, selectedStructurePosition, structureEntityId],
  );

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
            canOpenLocal={selectedStructurePosition !== null}
            mapLayer={mapLayer}
            showLayerSwitch={showLayerSwitch}
            onNavigate={navigateToView}
            onLayerChange={switchLayer}
          />
        }
      />

      {/* Camera-following status toast — extracted from the old wrapper so it floats independently. */}
      {isFollowingArmy && (
        <div className="pointer-events-auto fixed left-1/2 top-16 z-50 -translate-x-1/2">
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
