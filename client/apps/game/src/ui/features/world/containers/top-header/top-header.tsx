import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBlockTimestamp, getEntityInfo, getIsBlitz, Position } from "@bibliothecadao/eternum";

import { useUISound } from "@/audio/hooks/useUISound";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SecondaryMenuItems } from "@/ui/features/world";
import { GameEndTimer } from "./game-end-timer";
import { TickProgress } from "./tick-progress";
import {
  MIN_REFRESH_INTERVAL_MS,
  useLandingLeaderboardStore,
} from "@/ui/features/landing/lib/use-landing-leaderboard-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { EyeIcon, Swords } from "lucide-react";
import { memo, useCallback, useEffect, useMemo } from "react";

const slideDown = {
  hidden: { y: "-100%" },
  visible: { y: "0%", transition: { duration: 0.3 } },
};

export const TopHeader = memo(() => {
  const {
    setup,
    account: { account },
  } = useDojo();

  const { isMapView } = useQuery();

  const playClick = useUISound("ui.click");
  const playHover = useUISound("ui.hover");

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const followArmyCombats = useUIStore((state) => state.followArmyCombats);
  const setFollowArmyCombats = useUIStore((state) => state.setFollowArmyCombats);
  const lastControlledStructureEntityId = useUIStore((state) => state.lastControlledStructureEntityId);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const accountName = useAccountStore((state) => state.accountName);

  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  // force a refresh of getEntityInfo when the structure data arrives
  const structure = useComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]));
  const entityInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), setup.components, getIsBlitz()),
    [structureEntityId, currentDefaultTick, account.address, structure],
  );

  const selectedStructure = useMemo(() => {
    return entityInfo;
  }, [structureEntityId, entityInfo]);

  const selectedStructurePosition = useMemo(() => {
    return new Position(selectedStructure?.position || { x: 0, y: 0 }).getNormalized();
  }, [selectedStructure]);

  console.log("[TopHeader] selectedStructure:", lastControlledStructureEntityId);

  const goToStructure = useGoToStructure(setup);

  const normalizeAddress = useCallback((value: string) => value.trim().toLowerCase(), []);

  const leaderboardEntries = useLandingLeaderboardStore((state) => state.entries);
  const playerEntries = useLandingLeaderboardStore((state) => state.playerEntries);
  const fetchLeaderboardEntries = useLandingLeaderboardStore((state) => state.fetchLeaderboard);
  const fetchPlayerEntry = useLandingLeaderboardStore((state) => state.fetchPlayerEntry);

  const headerRefreshIntervalMs = Math.max(MIN_REFRESH_INTERVAL_MS, 60_000);

  useEffect(() => {
    const refresh = () => {
      void fetchLeaderboardEntries({ limit: 50, force: true });
      if (account.address) {
        void fetchPlayerEntry(account.address, { force: true });
      }
    };

    refresh();
    const intervalId = window.setInterval(refresh, headerRefreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [account.address, fetchLeaderboardEntries, fetchPlayerEntry, headerRefreshIntervalMs]);

  const formatPoints = useCallback((points: number | null | undefined) => {
    if (points === null || points === undefined) {
      return "0";
    }
    const rounded = Math.round(points);
    return Number.isFinite(rounded) ? rounded.toLocaleString() : "0";
  }, []);

  const playerEntry = useMemo(() => {
    const normalizedAccount = normalizeAddress(account.address);
    return (
      leaderboardEntries.find((entry) => normalizeAddress(entry.address) === normalizedAccount) ??
      playerEntries[normalizedAccount]?.data ??
      null
    );
  }, [account.address, leaderboardEntries, normalizeAddress, playerEntries]);

  return (
    <div className="pointer-events-auto w-screen flex justify-between">
      <motion.div
        className="top-header-bar flex flex-nowrap items-center gap-3 bg-dark-wood panel-wood panel-wood-corners w-full px-3 py-2"
        variants={slideDown}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-1 min-w-0 items-center gap-3 overflow-hidden">
          <div className="flex flex-1 min-w-0 flex-nowrap items-center gap-3">
            <div className="flex max-w-[420px] flex-shrink-0 flex-wrap items-center gap-2 truncate text-gold font-[Cinzel]">
              {isSpectating ? (
                <EyeIcon className="h-4 w-4 text-gold" aria-hidden="true" />
              ) : (
                <Swords className="h-4 w-4 text-gold" aria-hidden="true" />
              )}
              <span className="truncate text-base font-semibold">
                {accountName ?? playerEntry?.displayName ?? "Player"}
              </span>
              {isSpectating && playerStructures.length === 0 ? (
                <span className="text-xs text-gold/70 font-[Cinzel]">· Spectating</span>
              ) : playerEntry?.rank ? (
                <span className="text-xs text-gold/70 font-[Cinzel]">
                  · Rank #{playerEntry.rank} · {formatPoints(playerEntry.points)} pts
                </span>
              ) : (
                <span className="text-xs text-gold/70 font-[Cinzel]">· Spectating</span>
              )}
            </div>

            <div className="h-6 w-px bg-gold/20" />

            <div className="flex flex-shrink-0 flex-nowrap items-center gap-3 text-xs md:text-base">
              <div className="cycle-selector flex justify-center md:justify-start gap-2 whitespace-nowrap">
                <TickProgress />
                <GameEndTimer />
              </div>
              <div className="map-button-selector flex items-center justify-center md:justify-start gap-2 px-3 whitespace-nowrap">
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
                  className={cn("text-xs", !isMapView && "text-gold font-bold")}
                >
                  Local
                </span>
                <label className="relative inline-flex items-center cursor-pointer" onMouseEnter={() => playHover()}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isMapView}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      playClick();
                      goToStructure(
                        // if there's a controlled structure, needs to go back there
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
                  className={cn("text-xs", isMapView && "text-gold font-bold")}
                >
                  World
                </span>
                <div className="relative flex gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-full p-2 transition-all duration-300 border-2",
                      followArmyCombats
                        ? "bg-gold/30 hover:bg-gold/40 border-gold shadow-lg shadow-gold/20 animate-pulse"
                        : "bg-gold/10 hover:bg-gold/20 border-gold/30",
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
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 ml-auto">
          <SecondaryMenuItems />
        </div>

        {/* Camera Following Status Indicator */}
        {isFollowingArmy && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-5 z-50">
            <div className="bg-dark-wood text-gold px-4 py-2 rounded-lg shadow-lg border-2 border-gold animate-bounce">
              <div className="flex items-center gap-2">
                {followingArmyMessage?.toLowerCase().includes("combat") ? (
                  <Swords className="w-4 h-4 animate-pulse text-gold" />
                ) : (
                  <EyeIcon className="w-4 h-4 animate-pulse text-gold" />
                )}
                <span className="text-sm font-semibold text-gold">{followingArmyMessage ?? "Following Army"}</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
});

TopHeader.displayName = "TopHeader";
