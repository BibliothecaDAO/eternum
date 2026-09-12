import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { HudHeaderLayout } from "./hud-header-layout";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@bibliothecadao/eternum";

import { useUISound } from "@/audio/hooks/useUISound";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SecondaryMenuItems } from "@/ui/features/world";
import { GameClock } from "./game-clock";
import { AttentionPill } from "./attention-pill";
import { IdentityChip } from "./identity-chip";
import { TOP_PILL } from "./top-pill";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import Mountain from "lucide-react/dist/esm/icons/mountain";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Swords from "lucide-react/dist/esm/icons/swords";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { gameEntityKey } from "@/sync/game-scope";
export const TopHeader = memo(() => {
  const lane = useCompactLane();
  const {
    setup,
    account: { account },
  } = useDojo();

  const playClick = useUISound("ui.click");

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const lastControlledStructureEntityId = useUIStore((state) => state.lastControlledStructureEntityId);
  const mode = useGameModeConfig();

  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  const currentDefaultTick = useCurrentDefaultTick();

  // force a refresh of getEntityInfo when the structure data arrives
  const structure = useComponentValue(setup.components.Structure, gameEntityKey([BigInt(structureEntityId)]));
  const entityInfo = useMemo(
    () => mode.structure.getEntityInfo(structureEntityId, ContractAddress(account.address), setup.components),
    [structureEntityId, currentDefaultTick, account.address, structure, mode],
  );

  const selectedStructure = useMemo(() => {
    return entityInfo;
  }, [structureEntityId, entityInfo]);

  const selectedStructurePosition = useMemo(() => {
    return new Position(selectedStructure?.position || { x: 0, y: 0 }).getNormalized();
  }, [selectedStructure]);
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
      playClick();
      goToStructure(
        world ? lastControlledStructureEntityId || structureEntityId : structureEntityId,
        new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
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
            isLocalView={isLocalView}
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

function MapViewControls({
  isLocalView,
  mapLayer,
  showLayerSwitch,
  onNavigate,
  onLayerChange,
}: {
  isLocalView: boolean;
  mapLayer: boolean;
  showLayerSwitch: boolean;
  onNavigate: (world: boolean) => void;
  onLayerChange: (alt: boolean) => void;
}) {
  const pillButton = (active: boolean) =>
    cn(
      HUD_LABEL_BRIGHT,
      "min-h-11 min-w-11 rounded-md px-3 font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:min-h-7",
      active ? "bg-gold/20 text-gold" : "text-gold/65",
    );
  const layerButton = (active: boolean) =>
    cn(
      HUD_LABEL_BRIGHT,
      "inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-3 font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:min-h-7",
      active ? "bg-cyan-400/15 text-cyan-100" : "text-gold/65",
    );
  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Map view" className={cn(TOP_PILL, "gap-0.5 px-1 max-lg:h-auto")}>
        <button
          type="button"
          aria-pressed={isLocalView}
          onClick={() => onNavigate(false)}
          className={pillButton(isLocalView)}
        >
          Local
        </button>
        <button
          type="button"
          aria-pressed={!isLocalView}
          onClick={() => onNavigate(true)}
          className={pillButton(!isLocalView)}
        >
          World
        </button>
      </div>
      {showLayerSwitch && (
        <div role="group" aria-label="Map layer" className={cn(TOP_PILL, "gap-0.5 px-1 max-lg:h-auto")}>
          <button
            type="button"
            aria-pressed={!mapLayer}
            onClick={() => onLayerChange(false)}
            className={layerButton(!mapLayer)}
          >
            <Mountain className="h-3.5 w-3.5" aria-hidden />
            Surface
          </button>
          <button
            type="button"
            aria-pressed={mapLayer}
            onClick={() => onLayerChange(true)}
            className={layerButton(mapLayer)}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Ethereal
          </button>
        </div>
      )}
    </div>
  );
}
