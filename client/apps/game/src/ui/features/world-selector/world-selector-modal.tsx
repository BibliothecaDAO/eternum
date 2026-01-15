import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactoryWorlds, type FactoryWorld } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability, getAvailabilityStatus, getWorldKey } from "@/hooks/use-world-availability";
import {
  clearActiveWorld,
  deleteWorldProfile,
  getActiveWorldName,
  getWorldProfiles,
  listWorldNames,
  resolveChain,
  setSelectedChain,
} from "@/runtime/world";
import type { WorldSelectionInput } from "@/runtime/world";
import Button from "@/ui/design-system/atoms/button";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { AlertCircle, Check, Globe, Loader2, Play, RefreshCw, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chain } from "@contracts";
import { env } from "../../../../env";

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const normalizeFactoryChain = (chain: Chain): Chain => {
  if (chain === "slottest" || chain === "local") return "slot";
  return chain;
};

const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};

const parseMaybeBool = (v: unknown): boolean | null => {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const trimmed = v.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  const numeric = parseMaybeHexToNumber(v);
  if (numeric == null) return null;
  return numeric !== 0;
};

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

const fetchPlayerRegistrationStatus = async (
  toriiBaseUrl: string,
  playerLiteral: string | null,
): Promise<boolean | null> => {
  if (!playerLiteral) return null;
  try {
    const query = `SELECT registered FROM "s1_eternum-BlitzRealmPlayerRegister" WHERE player = "${playerLiteral}" LIMIT 1;`;
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const [row] = (await response.json()) as Record<string, unknown>[];
    if (row && row.registered != null) {
      return parseMaybeBool(row.registered);
    }
  } catch {
    // ignore fetch errors; caller handles defaults
  }
  return null;
};

type WorldMeta = {
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isRegistered: boolean | null;
  registrationCheckedFor: string | null;
};

export type WorldSelection = WorldSelectionInput;

type FactoryGameDisplay = {
  name: string;
  chain: Chain;
  worldKey: string;
  status: "checking" | "ok" | "fail";
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isRegistered: boolean | null;
};

type SavedWorldDisplay = {
  name: string;
  chain?: Chain;
  worldKey: string;
};

const resolveSavedChain = (storedChain: Chain | undefined, factoryChains?: Chain[]): Chain | undefined => {
  if (factoryChains && factoryChains.length > 0) {
    if (factoryChains.length === 1) return factoryChains[0];
    if (storedChain && factoryChains.includes(storedChain)) return storedChain;
    return factoryChains[0];
  }
  return storedChain;
};

export const WorldSelectorModal = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: (selection: WorldSelection) => void;
  onCancel: () => void;
}) => {
  const close = useUIStore((s) => s.setModal);
  const [saved, setSaved] = useState<string[]>(() => listWorldNames());
  const [selected, setSelected] = useState<string | null>(getActiveWorldName());
  const [selectedFactory, setSelectedFactory] = useState<FactoryWorld | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [playerRegistration, setPlayerRegistration] = useState<Record<string, boolean | null>>({});
  const [showEnded, setShowEnded] = useState(false);
  const [showAwaiting, setShowAwaiting] = useState(false);
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;

  // Use hook for game status filtering (updates every 10s, not every 1s)
  const { nowSec, isOngoing, isEnded, isUpcoming } = useGameTimeStatus();

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

  const factoryChainsByName = useMemo(() => {
    const map = new Map<string, Chain[]>();
    factoryWorlds.forEach((world) => {
      const existing = map.get(world.name) ?? [];
      if (!existing.includes(world.chain)) existing.push(world.chain);
      map.set(world.name, existing);
    });
    return map;
  }, [factoryWorlds]);

  const savedWorlds = useMemo<SavedWorldDisplay[]>(() => {
    const profiles = getWorldProfiles();
    return saved.map((name) => {
      const storedChain = profiles[name]?.chain as Chain | undefined;
      const factoryChains = factoryChainsByName.get(name);
      const chain = resolveSavedChain(storedChain, factoryChains);
      return { name, chain, worldKey: getWorldKey({ name, chain }) };
    });
  }, [saved, factoryChainsByName]);

  const savedWorldRefs = useMemo(
    () => savedWorlds.map((world) => ({ name: world.name, chain: world.chain })),
    [savedWorlds],
  );

  const savedWorldsByName = useMemo(() => {
    const map = new Map<string, SavedWorldDisplay>();
    savedWorlds.forEach((world) => map.set(world.name, world));
    return map;
  }, [savedWorlds]);

  // Use cached availability hook for saved worlds
  const { results: savedAvailability, allSettled: savedChecksDone } = useWorldsAvailability(
    savedWorldRefs,
    savedWorldRefs.length > 0,
  );

  // Derive statusMap from savedAvailability for backwards compatibility
  const statusMap = useMemo(() => {
    const map: Record<string, "checking" | "ok" | "fail"> = {};
    savedWorldRefs.forEach((world) => {
      const availability = savedAvailability.get(getWorldKey(world));
      map[world.name] = getAvailabilityStatus(availability);
    });
    return map;
  }, [savedWorldRefs, savedAvailability]);

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
      if (selected && offlineGames.includes(selected)) {
        setSelected(null);
      }
    }
  }, [savedChecksDone, saved, savedAvailability, selected, savedWorldRefs]);

  // Fetch player registration status for online worlds (factory + saved)
  useEffect(() => {
    if (!playerFeltLiteral) return;
    let cancelled = false;

    const allOnlineWorlds = [
      ...factoryWorlds.filter((world) => {
        const availability = factoryAvailability.get(getWorldKey(world));
        return availability?.isAvailable && !availability.isLoading;
      }),
      ...savedWorldRefs.filter((world) => {
        const availability = savedAvailability.get(getWorldKey(world));
        return availability?.isAvailable && !availability.isLoading;
      }),
    ];

    const seen = new Set<string>();
    const uniqueWorlds = allOnlineWorlds.filter((world) => {
      const key = getWorldKey(world);
      if (seen.has(key)) return false;
      seen.add(key);
      return playerRegistration[key] === undefined;
    });
    if (uniqueWorlds.length === 0) return;

    const run = async () => {
      const limit = 6;
      let index = 0;
      const work = async () => {
        while (!cancelled && index < uniqueWorlds.length) {
          const i = index++;
          const world = uniqueWorlds[i];
          const key = getWorldKey(world);
          const torii = buildToriiBaseUrl(world.name);
          const status = await fetchPlayerRegistrationStatus(torii, playerFeltLiteral);
          if (!cancelled) {
            setPlayerRegistration((prev) => ({ ...prev, [key]: status }));
          }
        }
      };
      const workers: Promise<void>[] = [];
      for (let k = 0; k < limit; k++) workers.push(work());
      await Promise.all(workers);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [playerFeltLiteral, factoryWorlds, factoryAvailability, savedWorldRefs, savedAvailability, playerRegistration]);

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
        isRegistered: playerRegistration[worldKey] ?? null,
      };
    });
  }, [factoryWorlds, factoryAvailability, playerRegistration]);

  // Build savedWorldMeta from cached availability for backwards compatibility
  const savedWorldMeta = useMemo(() => {
    const meta: Record<string, WorldMeta> = {};
    savedWorlds.forEach((world) => {
      const availability = savedAvailability.get(world.worldKey);
      if (availability?.isAvailable && availability.meta) {
        meta[world.name] = {
          startMainAt: availability.meta.startMainAt,
          endAt: availability.meta.endAt,
          registrationCount: availability.meta.registrationCount,
          isRegistered: playerRegistration[world.worldKey] ?? null,
          registrationCheckedFor: playerAddress?.toLowerCase() ?? null,
        };
      }
    });
    return meta;
  }, [savedWorlds, savedAvailability, playerRegistration, playerAddress]);

  const factoryLoading = factoryWorldsLoading || (factoryWorlds.length > 0 && factoryCheckingAvailability);
  const factoryErrorMessage = factoryError ? factoryError.message : null;

  const handleRefresh = useCallback(async () => {
    setPlayerRegistration({});
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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const confirm = () => {
    const selection: WorldSelection | null = selectedFactory
      ? { name: selectedFactory.name, chain: selectedFactory.chain }
      : selected
        ? { name: selected, chain: savedWorldsByName.get(selected)?.chain }
        : null;
    if (!selection) return;
    close(null, false);
    onConfirm(selection);
  };

  const cancel = () => {
    close(null, false);
    onCancel();
  };

  const handleRemoveWorld = (worldName: string) => {
    deleteWorldProfile(worldName);
    setSaved(listWorldNames());
    if (selected === worldName) setSelected(null);
  };

  const handleEnterGame = (world: SavedWorldDisplay) => {
    const status = statusMap[world.name];
    if (status !== "ok") return; // Don't allow entering offline games

    close(null, false);
    onConfirm({ name: world.name, chain: world.chain });
  };

  const handleDoubleClick = (world: SavedWorldDisplay) => {
    handleEnterGame(world);
  };

  const handleEnterFactoryGame = (game: FactoryGameDisplay) => {
    if (normalizeFactoryChain(game.chain) !== activeFactoryChain) return;
    close(null, false);
    onConfirm({ name: game.name, chain: game.chain });
  };

  const isGameOnline = (world: SavedWorldDisplay) => {
    return statusMap[world.name] === "ok";
  };

  const renderRegistrationSummary = ({
    registrationCount,
    isRegistered,
    isOnline,
    isLoading,
    className = "mt-3",
  }: {
    registrationCount: number | null;
    isRegistered: boolean | null;
    isOnline: boolean;
    isLoading: boolean;
    className?: string;
  }) => {
    const countLabel =
      isLoading && registrationCount == null ? "Checking players…" : `${registrationCount ?? "—"} registered`;
    return (
      <div className={`${className} flex flex-wrap items-center gap-3 text-[10px] text-white/70`}>
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          {countLabel}
        </span>
        {playerAddress ? (
          isLoading ? (
            <span className="inline-flex items-center gap-1 text-white/60">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking…
            </span>
          ) : !isOnline ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-white/60">
              <UserX className="w-3 h-3" />
              Offline
            </span>
          ) : isRegistered == null ? (
            <span className="inline-flex items-center gap-1 text-white/60">
              <AlertCircle className="w-3 h-3" />
              Unavailable
            </span>
          ) : isRegistered ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brilliance/10 px-2 py-0.5 font-semibold text-brilliance">
              <UserCheck className="w-3 h-3" />
              Registered
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 font-semibold text-white/80">
              <UserX className="w-3 h-3" />
              Not registered
            </span>
          )
        ) : (
          <span className="text-white/60">Connect wallet to check</span>
        )}
      </div>
    );
  };

  const renderFactoryItem = (fg: FactoryGameDisplay) => {
    const isOnline = fg.status === "ok";
    const isUnconfigured = fg.startMainAt == null && isOnline;
    const gameIsEnded = isEnded(fg.startMainAt, fg.endAt);
    const isChainMatch = normalizeFactoryChain(fg.chain) === activeFactoryChain;
    const isInteractive = isOnline && isChainMatch;
    const isSelected = selectedFactory ? getWorldKey(selectedFactory) === fg.worldKey : false;

    return (
      <div
        key={fg.worldKey}
        className={`group relative rounded-lg border-2 p-4 transition-all duration-200 ${
          isInteractive ? "cursor-pointer" : "cursor-default"
        } ${
          isSelected
            ? gameIsEnded
              ? "border-gold/40 bg-brown/20 shadow-lg shadow-gold/10 opacity-70"
              : isUnconfigured
                ? "border-gold/60 bg-gold/5 shadow-lg shadow-gold/10"
                : "border-gold bg-gold/10 shadow-lg shadow-gold/20"
            : gameIsEnded
              ? "border-gold/10 bg-brown/20 hover:bg-brown/30 hover:border-gold/20 opacity-60"
              : isUnconfigured
                ? "border-gold/30 bg-gold/5 hover:bg-gold/10 hover:border-gold/40 opacity-80"
                : "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
        }`}
        onClick={() => {
          if (!isChainMatch) return;
          setSelectedFactory(fg);
        }}
        onDoubleClick={() => isInteractive && handleEnterFactoryGame(fg)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`truncate font-bold text-base ${
                  gameIsEnded ? "text-gold/50" : isUnconfigured ? "text-gold/70" : "text-gold"
                }`}
              >
                {fg.name}
              </div>
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
                <div className="flex-shrink-0 p-1 rounded-full bg-gold/20">
                  <Check className="w-3 h-3 text-gold" />
                </div>
              )}
            </div>
            <WorldCountdownDetailed
              startMainAt={fg.startMainAt}
              endAt={fg.endAt}
              status={fg.status}
              className={`text-sm md:text-base font-semibold mt-1 block ${
                gameIsEnded ? "text-white/40" : isUnconfigured ? "text-white/60" : "text-white"
              }`}
            />
            {renderRegistrationSummary({
              registrationCount: fg.registrationCount,
              isRegistered: fg.isRegistered,
              isOnline,
              isLoading: fg.status === "checking",
            })}
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border ${
                fg.status === "ok"
                  ? "bg-brilliance/10 text-brilliance border-brilliance/30"
                  : fg.status === "fail"
                    ? "bg-danger/10 text-danger border-danger/30"
                    : "bg-gold/10 text-gold/60 border-gold/20"
              }`}
            >
              {fg.status === "ok" ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-brilliance animate-pulse" />
                  Online
                </>
              ) : fg.status === "fail" ? (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Offline
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking
                </>
              )}
            </span>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Enter Game Button */}
              {isInteractive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnterFactoryGame(fg);
                  }}
                  className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 transition-all"
                  title="Enter game"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown/90 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="w-full max-w-4xl border-2 border-gold/30 bg-brown/95 panel-wood rounded-lg shadow-2xl shadow-black/50 overflow-hidden"
      >
        {/* Header */}
        <div className="relative border-b-2 border-gold/20 bg-gradient-to-b from-brown/80 to-transparent p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gold/10 border border-gold/30">
                <Globe className="w-6 h-6 text-gold" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gold uppercase">Select Game</h2>
                <p className="text-sm text-gold/60 mt-1">Choose your game </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
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
                      activeFactoryChain === "slot"
                        ? "bg-gold/20 text-gold"
                        : "text-gold/60 hover:text-gold hover:bg-gold/10"
                    }`}
                  >
                    Slot
                  </button>
                </div>
              </div>
              <Button onClick={cancel} variant="outline" size="md">
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Add New Game on top */}

          {/* Two columns: Factory left, Saved right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Factory games (left) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="text-xs font-semibold uppercase tracking-widest text-gold/80 px-2">Factory Games</div>
                {factoryLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide bg-gold/10 text-gold border border-gold/30">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading
                  </span>
                )}
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <button
                  onClick={() => void handleRefresh()}
                  disabled={factoryLoading}
                  className="p-1.5 rounded-md bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh factory games"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${factoryLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {saved.length > 0 && (
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-2 mb-2">
                  <p className="text-[10px] text-gold/60 text-center">
                    <span className="font-semibold">Tip:</span> Double-click to enter • Hover for actions
                  </p>
                </div>
              )}

              {/* Offline summary + bulk delete */}
              {/* {saved.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-gold/60">
                    Offline saved games: {saved.filter((n) => statusMap[n] === "fail").length}
                  </div>
                  <button
                    onClick={handleRemoveOfflineSaved}
                    className="text-[10px] px-2 py-1 rounded border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
                  >
                    Delete Offline
                  </button>
                </div>
              )} */}

              {/* Filters */}
              {/* <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-[10px] text-gold/60">
                  {factoryLoading
                    ? "Loading factory deployments..."
                    : factoryError
                      ? `Error: ${factoryError}`
                      : `Found ${factoryGames.filter((g) => g.status === "ok").length} online games`}
                </div>
                <div className="text-[10px] text-gold/60">Ordering: Starts next</div>
              </div> */}

              {/* Factory list container with visible loading overlay when refreshing */}
              <div className="relative">
                <div
                  className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar"
                  aria-busy={factoryLoading ? true : undefined}
                  aria-live="polite"
                >
                  {factoryLoading && factoryGames.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gold/20 p-8 text-center">
                      <Loader2 className="w-12 h-12 text-gold/50 mx-auto mb-3 animate-spin" />
                      <p className="text-sm text-gold/60 font-semibold">Loading factory games...</p>
                      <p className="text-xs text-gold/40 mt-1">Fetching available worlds from the factory</p>
                    </div>
                  ) : factoryErrorMessage ? (
                    <div className="rounded-lg border-2 border-danger/30 bg-danger/5 p-6 text-center">
                      <AlertCircle className="w-12 h-12 text-danger/60 mx-auto mb-2" />
                      <p className="text-sm text-danger font-semibold">Failed to load factory games</p>
                      <p className="text-xs text-danger/70 mt-1">{factoryErrorMessage}</p>
                      <button
                        onClick={() => void handleRefresh()}
                        className="mt-3 px-3 py-1.5 text-xs rounded-md bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : factoryGames.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gold/20 p-6 text-center">
                      <Globe className="w-12 h-12 text-gold/30 mx-auto mb-2" />
                      <p className="text-sm text-gold/60">No factory games found</p>
                      <p className="text-xs text-gold/40 mt-1">Check back later for new worlds</p>
                    </div>
                  ) : (
                    (() => {
                      const online = factoryGames.filter((fg) => fg.status === "ok");
                      const upcoming = online
                        .filter((fg) => isUpcoming(fg.startMainAt))
                        .sort((a, b) => (a.startMainAt as number) - (b.startMainAt as number));
                      const ongoing = online
                        .filter((fg) => isOngoing(fg.startMainAt, fg.endAt))
                        .sort((a, b) => {
                          // Infinite games (endAt === 0 or null) should be sorted by start time
                          if ((a.endAt === 0 || a.endAt == null) && (b.endAt === 0 || b.endAt == null)) {
                            return (a.startMainAt as number) - (b.startMainAt as number);
                          }
                          if (a.endAt === 0 || a.endAt == null) return -1; // Infinite games first
                          if (b.endAt === 0 || b.endAt == null) return 1;
                          // Sort by time remaining (soonest to end first)
                          return (a.endAt as number) - nowSec - ((b.endAt as number) - nowSec);
                        });
                      const ended = online
                        .filter((fg) => isEnded(fg.startMainAt, fg.endAt))
                        .sort((a, b) => (b.endAt as number) - (a.endAt as number));
                      const unknown = online
                        .filter((fg) => fg.startMainAt == null)
                        .sort((a, b) => a.name.localeCompare(b.name));

                      return (
                        <>
                          {ongoing.length > 0 && (
                            <>
                              <div className="flex items-center gap-2 my-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Ongoing
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </div>
                              {ongoing.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                          {upcoming.length > 0 && (
                            <>
                              <div className="flex items-center gap-2 my-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Upcoming
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </div>
                              {upcoming.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                          {ended.length > 0 && (
                            <>
                              <button
                                onClick={() => setShowEnded(!showEnded)}
                                className="flex items-center gap-2 my-2 w-full hover:opacity-80 transition-opacity cursor-pointer"
                              >
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Ended ({ended.length}) {showEnded ? "▲" : "▼"}
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </button>
                              {showEnded && ended.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                          {unknown.length > 0 && (
                            <>
                              <button
                                onClick={() => setShowAwaiting(!showAwaiting)}
                                className="flex items-center gap-2 my-2 w-full hover:opacity-80 transition-opacity cursor-pointer"
                              >
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Awaiting Configuration ({unknown.length}) {showAwaiting ? "▲" : "▼"}
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </button>
                              {showAwaiting && unknown.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
                {factoryLoading && factoryGames.length > 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-brown/80 backdrop-blur-sm">
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 text-gold animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gold font-semibold">Refreshing factory games…</p>
                      <p className="text-xs text-gold/70">Updating world availability and timers</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Saved worlds (right) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="text-xs font-semibold uppercase tracking-widest text-gold/80 px-2">Recent Games</div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              </div>

              {saved.length > 0 && (
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-2 mb-2">
                  <p className="text-[10px] text-gold/60 text-center">
                    <span className="font-semibold">Tip:</span> Double-click to enter • Hover for actions
                  </p>
                </div>
              )}

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {saved.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-gold/20 p-6 text-center">
                    <Globe className="w-12 h-12 text-gold/30 mx-auto mb-2" />
                    <p className="text-sm text-gold/60">No recent games yet</p>
                    <p className="text-xs text-gold/40 mt-1">Enter a world name to begin your conquest</p>
                  </div>
                )}
                {(() => {
                  // Categorize saved games
                  const categorized = savedWorlds.map((world) => {
                    const gameIsOnline = isGameOnline(world);
                    const meta = savedWorldMeta[world.name];
                    const startMainAt = meta?.startMainAt ?? null;
                    const endAt = meta?.endAt ?? null;
                    const gameIsEnded = gameIsOnline && isEnded(startMainAt, endAt);
                    const gameIsOngoing = gameIsOnline && isOngoing(startMainAt, endAt);
                    const gameIsUpcoming = gameIsOnline && isUpcoming(startMainAt);

                    return {
                      name: world.name,
                      chain: world.chain,
                      isOnline: gameIsOnline,
                      meta,
                      isEnded: gameIsEnded,
                      isOngoing: gameIsOngoing,
                      isUpcoming: gameIsUpcoming,
                    };
                  });

                  // Sort: live (ongoing) first, then upcoming, then ended, then others
                  const live = categorized.filter((g) => g.isOngoing);
                  const upcoming = categorized.filter((g) => g.isUpcoming);
                  const ended = categorized.filter((g) => g.isEnded);
                  const others = categorized.filter((g) => !g.isOngoing && !g.isUpcoming && !g.isEnded);

                  const sorted = [...live, ...upcoming, ...ended, ...others];

                  return sorted.map(({ name: s, chain, isOnline, isEnded: gameIsEnded, meta }) => {
                    const isChainMatch = chain ? normalizeFactoryChain(chain) === activeFactoryChain : true;
                    return (
                      <div
                        key={s}
                        className={`group relative rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer ${
                          selected === s
                            ? isOnline
                              ? gameIsEnded
                                ? "border-gold/40 bg-brown/20 shadow-lg shadow-gold/10 opacity-70"
                                : "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                              : "border-danger/50 bg-danger/5 shadow-lg shadow-danger/10"
                            : isOnline
                              ? gameIsEnded
                                ? "border-gold/10 bg-brown/20 hover:bg-brown/30 hover:border-gold/20 opacity-60"
                                : "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
                              : "border-danger/40 bg-danger/5 hover:bg-danger/10"
                        }`}
                        onClick={() => setSelected(s)}
                        onDoubleClick={() =>
                          handleDoubleClick(savedWorldsByName.get(s) ?? { name: s, chain: undefined, worldKey: s })
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={`truncate font-bold text-base ${gameIsEnded ? "text-gold/50" : "text-gold"}`}
                              >
                                {s}
                              </div>
                              {chain && (
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                    chain === "mainnet"
                                      ? "border-brilliance/30 bg-brilliance/10 text-brilliance"
                                      : "border-gold/30 bg-gold/10 text-gold/70"
                                  } ${isChainMatch ? "" : "opacity-60"}`}
                                >
                                  {chain}
                                </span>
                              )}
                              {selected === s && (
                                <div className="flex-shrink-0 p-1 rounded-full bg-gold/20">
                                  <Check className="w-3 h-3 text-gold" />
                                </div>
                              )}
                            </div>
                            {isOnline && meta != null && meta.startMainAt != null && (
                              <WorldCountdownDetailed
                                startMainAt={meta.startMainAt}
                                endAt={meta.endAt}
                                status={statusMap[s]}
                                className={`text-sm md:text-base font-semibold mt-1 block ${
                                  gameIsEnded ? "text-white/40" : "text-white"
                                }`}
                              />
                            )}
                            {renderRegistrationSummary({
                              registrationCount: meta?.registrationCount ?? null,
                              isRegistered: meta?.isRegistered ?? null,
                              isOnline,
                              isLoading: statusMap[s] === "checking" || (isOnline && !meta),
                              className: "mt-2",
                            })}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {/* Status Badge */}
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border ${
                                statusMap[s] === "ok"
                                  ? "bg-brilliance/10 text-brilliance border-brilliance/30"
                                  : statusMap[s] === "fail"
                                    ? "bg-danger/10 text-danger border-danger/30"
                                    : "bg-gold/10 text-gold/60 border-gold/20"
                              }`}
                            >
                              {statusMap[s] === "ok" ? (
                                <>
                                  <div className="w-1.5 h-1.5 rounded-full bg-brilliance animate-pulse" />
                                  Online
                                </>
                              ) : statusMap[s] === "fail" ? (
                                <>
                                  <AlertCircle className="w-3 h-3" />
                                  Offline
                                </>
                              ) : (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Checking
                                </>
                              )}
                            </span>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Enter Game Button */}
                              {isOnline && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEnterGame(
                                      savedWorldsByName.get(s) ?? { name: s, chain: undefined, worldKey: s },
                                    );
                                  }}
                                  className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 transition-all"
                                  title="Enter game"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* Delete Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveWorld(s);
                                }}
                                className="p-1.5 rounded-md text-danger/60 hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/30"
                                title="Remove game"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
        {/* Footer removed; actions moved to header */}
      </div>

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
