import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
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
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import Swords from "lucide-react/dist/esm/icons/swords";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { gameEntityKey } from "@/sync/game-scope";
export const TopHeader = memo(() => {
  const {
    setup,
    account: { account },
  } = useDojo();

  const { handleUrlChange } = useQuery();

  const playClick = useUISound("ui.click");
  const playHover = useUISound("ui.hover");

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
  const showFastTravelLayerToggle = mode.id === "eternum";
  const isFastTravelView = currentPathname.includes("/travel");
  const isLocalView = currentPathname.includes("/hex");
  const isWorldView = !isLocalView;

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

  const navigateToFastTravelLayer = useCallback(() => {
    playClick();

    if (isFastTravelView) {
      goToStructure(
        lastControlledStructureEntityId || structureEntityId,
        new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
        true,
      );
      return;
    }

    const col = selectedStructurePosition.x;
    const row = selectedStructurePosition.y;
    handleUrlChange(`/play/travel?col=${col}&row=${row}`);
  }, [
    goToStructure,
    handleUrlChange,
    isFastTravelView,
    lastControlledStructureEntityId,
    playClick,
    selectedStructurePosition.x,
    selectedStructurePosition.y,
    structureEntityId,
  ]);

  return (
    <>
      {/* The header row: pointer-events pass through the gaps between pills so the map remains clickable; each
          pill flips pointer-events back on. The columns start below this row (HUD_COLUMN_TOP), so the cluster is
          centred on the full width: identity · view · clock · attention · settings. */}
      <div className="fixed top-0 inset-x-0 z-20 flex h-11 items-center justify-center gap-2 px-3 pointer-events-none">
        {/* 1. Identity chip — who you are in this game (spectating / not signed in / connecting / player) */}
        <IdentityChip />

        {/* 3. Local / World toggle (+ conditional Ethereal layer chip) */}
        <div className={cn(TOP_PILL, "whitespace-nowrap")}>
          <button
            type="button"
            aria-pressed={isLocalView}
            onClick={() => {
              playClick();
              goToStructure(
                structureEntityId,
                new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                false,
              );
            }}
            onMouseEnter={() => playHover()}
            className={cn("cursor-pointer", HUD_LABEL_BRIGHT, !isLocalView && "text-gold/55")}
          >
            Local
          </button>
          <label className="relative inline-flex items-center cursor-pointer" onMouseEnter={() => playHover()}>
            <input
              type="checkbox"
              aria-label="Show world map"
              className="sr-only peer"
              checked={isWorldView}
              onChange={(e) => {
                const checked = e.target.checked;
                playClick();
                goToStructure(
                  lastControlledStructureEntityId || structureEntityId,
                  new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                  checked,
                );
              }}
            />
            <div className="w-10 h-5 rounded-full peer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all bg-gold/30"></div>
          </label>
          <button
            type="button"
            aria-pressed={isWorldView && !isFastTravelView}
            onClick={() => {
              playClick();
              goToStructure(
                structureEntityId,
                new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                true,
              );
            }}
            onMouseEnter={() => playHover()}
            className={cn("cursor-pointer", HUD_LABEL_BRIGHT, !isWorldView && "text-gold/55")}
          >
            World
          </button>
          {showFastTravelLayerToggle && (
            <button
              type="button"
              onClick={navigateToFastTravelLayer}
              onMouseEnter={() => playHover()}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200",
                isFastTravelView
                  ? "border-cyan-300 bg-cyan-400/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                  : "border-gold/25 bg-gold/10 text-gold/75 hover:border-gold/40 hover:text-gold",
              )}
              title={isFastTravelView ? "Return to World Layer" : "Go to Ethereal Layer"}
            >
              Ethereal
            </button>
          )}
        </div>

        <GameClock />
        <AttentionPill />

        <SecondaryMenuItems />
      </div>

      {/* Camera-following status toast — extracted from the old wrapper so it floats independently. */}
      {isFollowingArmy && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-lg border-2 border-gold bg-black/40 px-4 py-2 text-gold shadow-lg animate-bounce">
            {followingArmyMessage?.toLowerCase().includes("combat") ? (
              <Swords className="w-4 h-4 animate-pulse text-gold" />
            ) : (
              <EyeIcon className="w-4 h-4 animate-pulse text-gold" />
            )}
            <span className="text-sm font-semibold text-gold">{followingArmyMessage ?? "Following Army"}</span>
          </div>
        </div>
      )}
    </>
  );
});

TopHeader.displayName = "TopHeader";
