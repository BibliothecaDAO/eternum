import { Eye as EyeIcon, Swords } from "@/ui/design-system/atoms/game-icons";
import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { HudHeaderLayout } from "./hud-header-layout";
import { MapViewControls } from "./map-view-controls";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position, configManager } from "@bibliothecadao/eternum";

import { useUISound } from "@/audio/hooks/useUISound";
import { SecondaryMenuItems } from "@/ui/features/world";
import { GameClock } from "./game-clock";
import { AttentionPill } from "./attention-pill";
import { IdentityChip } from "./identity-chip";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
export const TopHeader = memo(() => {
  const lane = useCompactLane();
  const { setup } = useGame();

  const playClick = useUISound("ui.click");

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const lastControlledStructureEntityId = useUIStore((state) => state.lastControlledStructureEntityId);
  const mode = useGameModeConfig();

  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  const currentDefaultTick = useCurrentDefaultTick();

  // force a refresh of getEntityInfo when the structure data arrives
  const structure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: structureEntityId,
  });
  const entityInfo = useMemo(
    // Only the position is read here, so no viewer is needed.
    () => mode.structure.getEntityInfo(structureEntityId, null, setup.store),
    [structureEntityId, currentDefaultTick, structure, mode, setup.store],
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
        identity={<IdentityChip compact={lane !== null} />}
        clock={<GameClock compact={lane !== null} />}
        attention={<AttentionPill />}
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
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-lg border-2 border-gold bg-black/40 px-4 py-2 text-gold shadow-lg animate-bounce">
            {followingArmyMessage?.toLowerCase().includes("combat") ? (
              <Swords className="w-4 h-4 animate-pulse text-gold" />
            ) : (
              <EyeIcon className="w-4 h-4 animate-pulse text-gold" />
            )}
            <span className={HUD_LABEL_BRIGHT}>{followingArmyMessage ?? "Following Army"}</span>
          </div>
        </div>
      )}
    </>
  );
});

TopHeader.displayName = "TopHeader";
