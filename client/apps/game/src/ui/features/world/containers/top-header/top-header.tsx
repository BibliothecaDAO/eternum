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
import { WalletPill } from "./pills/wallet-pill";
import { TickProgress } from "./tick-progress";
import {
  MIN_REFRESH_INTERVAL_MS,
  useLandingLeaderboardStore,
} from "@/services/leaderboard/use-landing-leaderboard-store";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import Swords from "lucide-react/dist/esm/icons/swords";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
// Shared visual base for each top-zone pill cluster. Uses the Etched Bronze
// surface so it visually matches the view-switcher, right-side bubbles, and
// minimap — every HUD element shares one design language now.
const PILL_SURFACE = `pointer-events-auto rounded-full ${OVERLAY_SURFACE_BASE}`;

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
  // Gate the follow-army-combats toggle: there's nothing to follow until the player actually owns
  // an army. We keep it visible while it's already toggled on so a player can always turn it back off.
  const hasOwnedArmies = useUIStore((state) => state.selectableArmies.length > 0);
  const showFollowArmyToggle = hasOwnedArmies || followArmyCombats || isSpectating;
  const mode = useGameModeConfig();

  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  // force a refresh of getEntityInfo when the structure data arrives
  const structure = useComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]));
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

  // Keep the leaderboard cache warm for the rank pill in SecondaryMenuItems. The
  // pill reads the cached entries from the store; we drive the fetch from here
  // so a single mount handles polling.
  const fetchLeaderboardEntries = useLandingLeaderboardStore((state) => state.fetchLeaderboard);
  const fetchPlayerEntry = useLandingLeaderboardStore((state) => state.fetchPlayerEntry);

  useEffect(() => {
    void fetchLeaderboardEntries({ limit: 50 });
  }, [fetchLeaderboardEntries]);

  useEffect(() => {
    if (!account.address) return undefined;

    const refreshPlayer = () => {
      void fetchPlayerEntry(account.address);
    };

    refreshPlayer();
    const intervalId = window.setInterval(refreshPlayer, MIN_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [account.address, fetchPlayerEntry]);

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
          map remains clickable. Each pill flips pointer-events back on.
          Centered horizontally so the top zone mirrors the right-side column's
          vertical centering. */}
      <div className="fixed top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-center gap-3 px-3 py-2 pointer-events-none">
        {/* Spectating badge — only renders when actually spectating. The player
            identity itself lives in the rank pill on the right. */}
        {isSpectating && (
          <div
            className={cn(
              PILL_SURFACE,
              "flex items-center gap-1.5 px-3 py-1",
              HUD_LABEL_BRIGHT,
            )}
          >
            <EyeIcon className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            <span>Spectating</span>
          </div>
        )}

        {/* Structure picker moved to LeftStructureColumn header — it sits above
            the structure data it drives now. */}

        {/* Day-tick progress — its own pill, flattened so the SVG ring isn't nested in another border. */}
        <div className={cn(PILL_SURFACE, "flex items-center px-2 py-1")}>
          <TickProgress />
        </div>

        {/* Game start / end timers — each self-styled, only render when active. */}
        <GameStartCountdown />
        <GameEndTimer />

        {/* Map view pill — Local/World toggle + conditional Ethereal/Follow Army */}
        <div className={cn(PILL_SURFACE, "flex items-center gap-2 px-3 py-1 whitespace-nowrap")}>
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
            className={cn("cursor-pointer text-[11px] uppercase tracking-[0.16em] font-semibold text-gold/70", isLocalView && "text-gold")}
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
            <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all bg-gold/30"></div>
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
            className={cn("cursor-pointer text-[11px] uppercase tracking-[0.16em] font-semibold text-gold/70", isWorldView && "text-gold")}
          >
            World
          </span>
          {showFastTravelLayerToggle && (
            <button
              type="button"
              onClick={navigateToFastTravelLayer}
              onMouseEnter={() => playHover()}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] transition-all duration-200",
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

        {showFollowArmyToggle && (
          <button
            type="button"
            className={cn(
              "pointer-events-auto rounded-full p-2 transition-all duration-300",
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
            <Swords className={cn("w-4 h-4", followArmyCombats ? "text-gold animate-pulse" : "text-gold/60")} />
          </button>
        )}

        {/* Push the right cluster to the far edge */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <WalletPill />
          <SecondaryMenuItems />
        </div>
      </div>

      {/* Camera-following status toast — extracted from the old wrapper so it floats independently. */}
      {isFollowingArmy && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-lg border-2 border-gold bg-dark-wood px-4 py-2 text-gold shadow-lg animate-bounce">
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
