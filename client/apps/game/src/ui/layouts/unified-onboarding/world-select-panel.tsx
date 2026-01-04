import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Globe, Loader2, Play, RefreshCw, Users } from "lucide-react";

import { useFactoryWorlds, type FactoryWorld } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability, getAvailabilityStatus, getWorldKey } from "@/hooks/use-world-availability";
import { clearActiveWorld, getActiveWorldName, listWorldNames, resolveChain, setSelectedChain } from "@/runtime/world";
import { deleteWorldProfile } from "@/runtime/world/store";
import Button from "@/ui/design-system/atoms/button";
import { WorldCountdown, useGameTimeStatus } from "@/ui/components/world-countdown";
import type { Chain } from "@contracts";
import { env } from "../../../../env";

const normalizeFactoryChain = (chain: Chain): Chain => {
  if (chain === "slottest" || chain === "local") return "slot";
  return chain;
};

interface WorldSelectPanelProps {
  onSelect: (worldName: string) => void;
}

export const WorldSelectPanel = ({ onSelect }: WorldSelectPanelProps) => {
  const [saved, setSaved] = useState<string[]>(() => listWorldNames());
  const [selectedWorld, setSelectedWorld] = useState<FactoryWorld | null>(null);

  // Use hook for game status filtering (updates every 10s, not every 1s)
  const { isOngoing } = useGameTimeStatus();

  const resolvedChain = resolveChain(env.VITE_PUBLIC_CHAIN as Chain);
  const activeFactoryChain = normalizeFactoryChain(resolvedChain);
  const factoryChains = useMemo<Chain[]>(() => {
    const chains: Chain[] = ["mainnet", "slot"];
    if (activeFactoryChain && !chains.includes(activeFactoryChain)) {
      chains.push(activeFactoryChain);
    }
    return chains;
  }, [activeFactoryChain]);

  const {
    worlds: factoryWorlds,
    isLoading: factoryWorldsLoading,
    error: factoryError,
    refetchAll: refetchFactoryWorlds,
  } = useFactoryWorlds(factoryChains);

  // Use cached availability hook for factory worlds
  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchFactory,
  } = useWorldsAvailability(factoryWorlds, factoryWorlds.length > 0);

  const savedWorldRefs = useMemo(() => saved.map((name) => ({ name })), [saved]);

  // Use cached availability hook for saved worlds
  const { results: savedAvailability, allSettled: savedChecksDone } = useWorldsAvailability(
    savedWorldRefs,
    savedWorldRefs.length > 0,
  );

  const activeWorldName = useMemo(() => getActiveWorldName(), []);

  useEffect(() => {
    if (selectedWorld || !activeWorldName) return;
    const match = factoryWorlds.find(
      (world) => world.name === activeWorldName && normalizeFactoryChain(world.chain) === activeFactoryChain,
    );
    if (match) setSelectedWorld(match);
  }, [selectedWorld, activeWorldName, factoryWorlds, activeFactoryChain]);

  // Auto-delete offline saved games when checks complete
  useEffect(() => {
    if (!savedChecksDone || saved.length === 0) return;

    const offlineGames = savedWorldRefs
      .filter((world) => {
        const availability = savedAvailability.get(getWorldKey(world));
        return availability && !availability.isLoading && !availability.isAvailable;
      })
      .map((world) => world.name);

    if (offlineGames.length > 0) {
      offlineGames.forEach((n) => deleteWorldProfile(n));
      const updatedList = listWorldNames();
      setSaved(updatedList);
    }
  }, [savedChecksDone, saved, savedAvailability, savedWorldRefs]);

  // Build factory games list from cached availability results
  const factoryGames = useMemo(() => {
    return factoryWorlds.map((world) => {
      const worldKey = getWorldKey(world);
      const availability = factoryAvailability.get(worldKey);
      const status = getAvailabilityStatus(availability);
      return {
        name: world.name,
        chain: world.chain,
        worldKey,
        status,
        startMainAt: availability?.meta?.startMainAt ?? null,
        endAt: availability?.meta?.endAt ?? null,
        registrationCount: availability?.meta?.registrationCount ?? null,
      };
    });
  }, [factoryWorlds, factoryAvailability]);

  const factoryLoading = factoryWorldsLoading || (factoryWorlds.length > 0 && factoryCheckingAvailability);
  const factoryErrorMessage = factoryError ? factoryError.message : null;

  const handleRefresh = useCallback(async () => {
    await refetchFactoryWorlds();
    await refetchFactory();
  }, [refetchFactoryWorlds, refetchFactory]);

  const handleSwitchChain = useCallback(
    (nextChain: Chain) => {
      if (normalizeFactoryChain(nextChain) === activeFactoryChain) return;
      setSelectedChain(nextChain);
      clearActiveWorld();
      window.location.reload();
    },
    [activeFactoryChain],
  );

  const handleSelectWorld = (world: FactoryWorld) => {
    if (normalizeFactoryChain(world.chain) !== activeFactoryChain) return;
    setSelectedWorld(world);
  };

  const handleEnterWorld = (world: FactoryWorld) => {
    if (normalizeFactoryChain(world.chain) !== activeFactoryChain) return;
    onSelect(world.name);
  };

  // Filter and sort games using the hook's isOngoing function
  const onlineGames = factoryGames.filter((fg) => fg.status === "ok");
  const ongoingGames = onlineGames.filter((fg) => isOngoing(fg.startMainAt, fg.endAt));
  const selectedWorldKey = selectedWorld ? getWorldKey(selectedWorld) : null;

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gold">Select a World</h2>
        <p className="text-sm text-gold/60 mt-1">Choose a game world to enter</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gold/60">Chain</span>
          <div className="flex items-center gap-1 rounded-full border border-gold/20 bg-brown/80 p-1">
            <button
              type="button"
              onClick={() => handleSwitchChain("mainnet")}
              className={`px-2.5 py-1 text-[10px] font-semibold uppercase rounded-full transition ${
                activeFactoryChain === "mainnet"
                  ? "bg-gold/20 text-gold"
                  : "text-gold/60 hover:text-gold hover:bg-gold/10"
              }`}
            >
              Mainnet
            </button>
            <button
              type="button"
              onClick={() => handleSwitchChain("slot")}
              className={`px-2.5 py-1 text-[10px] font-semibold uppercase rounded-full transition ${
                activeFactoryChain === "slot" ? "bg-gold/20 text-gold" : "text-gold/60 hover:text-gold hover:bg-gold/10"
              }`}
            >
              Slot
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {factoryLoading && factoryGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-gold/50 animate-spin mb-3" />
            <p className="text-sm text-gold/60">Loading available worlds...</p>
          </div>
        ) : factoryErrorMessage ? (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-danger/60 mx-auto mb-2" />
            <p className="text-sm text-danger">{factoryErrorMessage}</p>
            <button
              onClick={() => void handleRefresh()}
              className="mt-3 px-3 py-1.5 text-xs rounded-md bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
            >
              Try Again
            </button>
          </div>
        ) : ongoingGames.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="w-8 h-8 text-gold/30 mx-auto mb-2" />
            <p className="text-sm text-gold/60">No active games found</p>
          </div>
        ) : (
          ongoingGames.map((fg) => {
            const isChainMatch = normalizeFactoryChain(fg.chain) === activeFactoryChain;
            const isSelected = selectedWorldKey === fg.worldKey;
            return (
              <div
                key={fg.worldKey}
                className={`group relative rounded-lg border-2 p-3 transition-all duration-200 ${
                  isChainMatch ? "cursor-pointer" : "cursor-default opacity-60"
                } ${
                  isSelected
                    ? "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                    : "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
                }`}
                onClick={() => handleSelectWorld(fg)}
                onDoubleClick={() => handleEnterWorld(fg)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gold truncate">{fg.name}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          fg.chain === "mainnet"
                            ? "border-brilliance/30 bg-brilliance/10 text-brilliance"
                            : "border-gold/30 bg-gold/10 text-gold/70"
                        } ${isChainMatch ? "" : "opacity-60"}`}
                      >
                        {fg.chain}
                      </span>
                      {isSelected && (
                        <div className="p-0.5 rounded-full bg-gold/20">
                          <Check className="w-3 h-3 text-gold" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
                      <WorldCountdown startMainAt={fg.startMainAt} endAt={fg.endAt} status={fg.status} />
                      {fg.registrationCount != null && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {fg.registrationCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-brilliance/10 text-brilliance border border-brilliance/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-brilliance animate-pulse" />
                      Online
                    </span>
                    {isChainMatch && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnterWorld(fg);
                        }}
                        className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Enter game"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Refresh button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => void handleRefresh()}
          disabled={factoryLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${factoryLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Enter button */}
      {selectedWorld && (
        <div className="mt-4">
          <Button className="w-full !h-12" variant="gold" onClick={() => handleEnterWorld(selectedWorld)}>
            Enter {selectedWorld.name}
          </Button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(223, 170, 84, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(223, 170, 84, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(223, 170, 84, 0.5);
        }
      `}</style>
    </div>
  );
};
