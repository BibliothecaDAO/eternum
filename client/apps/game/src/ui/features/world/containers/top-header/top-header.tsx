import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBlockTimestamp, Position } from "@bibliothecadao/eternum";

import { useUISound } from "@/audio/hooks/useUISound";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { SecondaryMenuItems } from "@/ui/features/world";
import { GameEndTimer } from "./game-end-timer";
import { GameStartCountdown } from "./game-start-countdown";
import { SuggestionsPill } from "./pills/suggestions-pill";
import { TickProgress } from "./tick-progress";
import { TOP_PILL, TOP_PILL_TEXT } from "./top-pill";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import Swords from "lucide-react/dist/esm/icons/swords";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { gameEntityKey } from "@/dojo/game-scope";
export const TopHeader = memo(() => {
  const {
    setup,
    account: { account },
  } = useDojo();

  const { handleUrlChange } = useQuery();

  const playClick = useUISound("ui.click");
  const playHover = useUISound("ui.hover");

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const followArmyCombats = useUIStore((state) => state.followArmyCombats);
  const setFollowArmyCombats = useUIStore((state) => state.setFollowArmyCombats);
  const lastControlledStructureEntityId = useUIStore((state) => state.lastControlledStructureEntityId);
  const isSpectating = useUIStore((state) => state.isSpectating);
  // The follow-army-combats toggle is a spectator-only affordance: it's for
  // watching other players' battles. Active players manage their own armies, so
  // it's hidden for them entirely.
  const showFollowArmyToggle = isSpectating;
  const mode = useGameModeConfig();

  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

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
      {/* Layout container — pointer-events pass through the gaps between pills so the
          map remains clickable. Each pill flips pointer-events back on. The
          center cluster carries the six headline pieces in canonical order
          (rank · view · day · timer · army toggle · settings); the right
          cluster carries ancillary status icons (network / tx / features). */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-center gap-2 px-3 py-2 pointer-events-none">
        {isSpectating && (
          <div className={cn(TOP_PILL, HUD_LABEL_BRIGHT)}>
            <EyeIcon className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            <span>Spectating</span>
          </div>
        )}

        {/* 1. Player rank */}
        <SecondaryMenuItems variant="rank" />

        {/* 2. Empire-wide suggested actions — sits right after the rank pill and
            is hidden while spectating (a spectator has no empire to act on). */}
        {!isSpectating && <SuggestionsPill />}

        {/* 3. Local / World toggle (+ conditional Ethereal layer chip) */}
        <div className={cn(TOP_PILL, "whitespace-nowrap")}>
          <span
            onClick={() => {
              playClick();
              goToStructure(
                structureEntityId,
                new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                false,
              );
            }}
            onMouseEnter={() => playHover()}
            className={cn("cursor-pointer", TOP_PILL_TEXT, !isLocalView && "text-gold/55")}
          >
            Local
          </span>
          <label className="relative inline-flex items-center cursor-pointer" onMouseEnter={() => playHover()}>
            <input
              type="checkbox"
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
            <div className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all bg-gold/30"></div>
          </label>
          <span
            onClick={() => {
              playClick();
              goToStructure(
                structureEntityId,
                new Position({ x: selectedStructurePosition.x, y: selectedStructurePosition.y }),
                true,
              );
            }}
            onMouseEnter={() => playHover()}
            className={cn("cursor-pointer", TOP_PILL_TEXT, !isWorldView && "text-gold/55")}
          >
            World
          </span>
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

        {/* 4. Day-tick progress */}
        <div className={TOP_PILL}>
          <TickProgress />
        </div>

        {/* 5. Game start / end timers — each self-styled, only render when active. */}
        <GameStartCountdown />
        <GameEndTimer />

        {/* 6. Army combat follow toggle */}
        {showFollowArmyToggle && (
          <button
            type="button"
            className={cn(
              "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300",
              OVERLAY_SURFACE_BASE,
              followArmyCombats
                ? "border-gold ring-1 ring-gold/40 shadow-[0_0_18px_rgba(223,170,84,0.35)] animate-pulse"
                : "hover:border-gold/50",
            )}
            onClick={() => {
              setFollowArmyCombats(!followArmyCombats);
              playClick();
            }}
            onMouseEnter={() => playHover()}
            aria-pressed={followArmyCombats}
            title={followArmyCombats ? "Stop following army combat" : "Follow army combat"}
          >
            <Swords className={cn("h-4 w-4", followArmyCombats ? "text-gold animate-pulse" : "text-gold/60")} />
          </button>
        )}

        {/* 7. Settings + ancillary status icons (network, tx, latest features…) */}
        <SecondaryMenuItems variant="rest" />
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
