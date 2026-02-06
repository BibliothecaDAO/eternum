import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactoryWorlds, type FactoryWorld } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability, getAvailabilityStatus, getWorldKey } from "@/hooks/use-world-availability";
import {
  deleteWorldProfile,
  getActiveWorldName,
  getWorldProfiles,
  listWorldNames,
  resolveChain,
  setSelectedChain,
  clearActiveWorld,
} from "@/runtime/world";
import type { WorldSelectionInput } from "@/runtime/world";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Check from "lucide-react/dist/esm/icons/check";
import Globe from "lucide-react/dist/esm/icons/globe";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Play from "lucide-react/dist/esm/icons/play";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import UserX from "lucide-react/dist/esm/icons/user-x";
import Users from "lucide-react/dist/esm/icons/users";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Chain } from "@contracts";
import { env } from "../../../../../../env";

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const normalizeFactoryChain = (chain: Chain): Chain => {
  if (chain === "slottest" || chain === "local") return "slot";
  return chain;
};

const parseMaybeBool = (v: unknown): boolean | null => {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const trimmed = v.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  return null;
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
    // ignore fetch errors
  }
  return null;
};

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

type WorldSelection = WorldSelectionInput;

interface InlineGameSelectorProps {
  onSelectGame: (selection: WorldSelection) => void;
  className?: string;
}

/**
 * Inline game selector that displays factory games and saved games
 * directly in the landing page (no modal).
 */
const InlineGameSelector = ({ onSelectGame, className }: InlineGameSelectorProps) => {
  const [saved, setSaved] = useState<string[]>(() => listWorldNames());
  const [selected, setSelected] = useState<string | null>(getActiveWorldName());
  const [selectedFactory, setSelectedFactory] = useState<FactoryWorld | null>(null);
  const [playerRegistration, setPlayerRegistration] = useState<Record<string, boolean | null>>({});
  const [showEnded, setShowEnded] = useState(false);
  const [showAwaiting, setShowAwaiting] = useState(false);
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;

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

  const resolveSavedChain = (storedChain: Chain | undefined, factoryChains?: Chain[]): Chain | undefined => {
    if (factoryChains && factoryChains.length > 0) {
      if (factoryChains.length === 1) return factoryChains[0];
      if (storedChain && factoryChains.includes(storedChain)) return storedChain;
      return factoryChains[0];
    }
    return storedChain;
  };

  const savedWorlds = useMemo<SavedWorldDisplay[]>(() => {
    const profiles = getWorldProfiles();
    return saved.map((name) => {
      const storedChain = profiles[name]?.chain as Chain | undefined;
      const chains = factoryChainsByName.get(name);
      const chain = resolveSavedChain(storedChain, chains);
      return { name, chain, worldKey: getWorldKey({ name, chain }) };
    });
  }, [saved, factoryChainsByName]);

  const savedWorldRefs = useMemo(
    () => savedWorlds.map((world) => ({ name: world.name, chain: world.chain })),
    [savedWorlds],
  );

  const { results: savedAvailability, allSettled: savedChecksDone } = useWorldsAvailability(
    savedWorldRefs,
    savedWorldRefs.length > 0,
  );

  const statusMap = useMemo(() => {
    const map: Record<string, "checking" | "ok" | "fail"> = {};
    savedWorldRefs.forEach((world) => {
      const availability = savedAvailability.get(getWorldKey(world));
      map[world.name] = getAvailabilityStatus(availability);
    });
    return map;
  }, [savedWorldRefs, savedAvailability]);

  // Auto-delete offline saved games
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

  // Fetch player registration status
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

  const savedWorldMeta = useMemo(() => {
    const meta: Record<
      string,
      {
        startMainAt: number | null;
        endAt: number | null;
        registrationCount: number | null;
        isRegistered: boolean | null;
      }
    > = {};
    savedWorlds.forEach((world) => {
      const availability = savedAvailability.get(world.worldKey);
      if (availability?.isAvailable && availability.meta) {
        meta[world.name] = {
          startMainAt: availability.meta.startMainAt,
          endAt: availability.meta.endAt,
          registrationCount: availability.meta.registrationCount,
          isRegistered: playerRegistration[world.worldKey] ?? null,
        };
      }
    });
    return meta;
  }, [savedWorlds, savedAvailability, playerRegistration]);

  const factoryLoading = factoryWorldsLoading || (factoryWorlds.length > 0 && factoryCheckingAvailability);
  const factoryErrorMessage = factoryError ? factoryError.message : null;

  const handleRefresh = useCallback(async () => {
    setPlayerRegistration({});
    await Promise.all([refetchFactoryWorlds(), refetchFactory()]);
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

  const handleRemoveWorld = (worldName: string) => {
    deleteWorldProfile(worldName);
    setSaved(listWorldNames());
    if (selected === worldName) setSelected(null);
  };

  const handleEnterGame = (world: SavedWorldDisplay) => {
    const status = statusMap[world.name];
    if (status !== "ok") return;
    onSelectGame({ name: world.name, chain: world.chain });
  };

  const handleEnterFactoryGame = (game: FactoryGameDisplay) => {
    if (normalizeFactoryChain(game.chain) !== activeFactoryChain) return;
    onSelectGame({ name: game.name, chain: game.chain });
  };

  const isGameOnline = (world: SavedWorldDisplay) => {
    return statusMap[world.name] === "ok";
  };

  const renderRegistrationSummary = ({
    registrationCount,
    isRegistered,
    isOnline,
    isLoading,
    className: extraClass = "mt-2",
  }: {
    registrationCount: number | null;
    isRegistered: boolean | null;
    isOnline: boolean;
    isLoading: boolean;
    className?: string;
  }) => {
    const countLabel =
      isLoading && registrationCount == null ? "Checking players..." : `${registrationCount ?? "-"} registered`;
    return (
      <div className={cn("flex flex-wrap items-center gap-2 text-[10px] text-gold/60", extraClass)}>
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          {countLabel}
        </span>
        {playerAddress ? (
          isLoading ? (
            <span className="inline-flex items-center gap-1 text-gold/50">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking...
            </span>
          ) : !isOnline ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/5 px-2 py-0.5 text-gold/50">
              <UserX className="w-3 h-3" />
              Offline
            </span>
          ) : isRegistered == null ? (
            <span className="inline-flex items-center gap-1 text-gold/50">
              <AlertCircle className="w-3 h-3" />
              Unavailable
            </span>
          ) : isRegistered ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brilliance/10 px-2 py-0.5 font-semibold text-brilliance">
              <UserCheck className="w-3 h-3" />
              Registered
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/5 px-2 py-0.5 font-semibold text-gold/70">
              <UserX className="w-3 h-3" />
              Not registered
            </span>
          )
        ) : (
          <span className="text-gold/50">Connect wallet to check</span>
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
        className={cn(
          "group relative rounded-lg border p-3 transition-all duration-200",
          isInteractive ? "cursor-pointer" : "cursor-default",
          isSelected
            ? gameIsEnded
              ? "border-gold/40 bg-black/40 opacity-70"
              : isUnconfigured
                ? "border-gold/60 bg-gold/5"
                : "border-gold bg-gold/10 shadow-lg shadow-gold/20"
            : gameIsEnded
              ? "border-gold/10 bg-black/30 hover:bg-black/40 hover:border-gold/20 opacity-60"
              : isUnconfigured
                ? "border-gold/30 bg-black/30 hover:bg-black/40 hover:border-gold/40 opacity-80"
                : "border-gold/20 bg-black/40 hover:bg-black/50 hover:border-gold/40",
        )}
        onClick={() => {
          if (!isChainMatch) return;
          setSelectedFactory(fg);
          setSelected(null);
        }}
        onDoubleClick={() => isInteractive && handleEnterFactoryGame(fg)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={cn(
                  "truncate font-bold text-sm",
                  gameIsEnded ? "text-gold/50" : isUnconfigured ? "text-gold/70" : "text-gold",
                )}
              >
                {fg.name}
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  fg.chain === "mainnet"
                    ? "border-brilliance/30 bg-brilliance/10 text-brilliance"
                    : "border-gold/30 bg-gold/10 text-gold/60",
                  isChainMatch ? "" : "opacity-60",
                )}
              >
                {fg.chain}
              </span>
              {isSelected && (
                <div className="flex-shrink-0 p-0.5 rounded-full bg-gold/20">
                  <Check className="w-3 h-3 text-gold" />
                </div>
              )}
            </div>
            <WorldCountdownDetailed
              startMainAt={fg.startMainAt}
              endAt={fg.endAt}
              status={fg.status}
              className={cn(
                "text-xs font-semibold mt-0.5 block",
                gameIsEnded ? "text-gold/40" : isUnconfigured ? "text-gold/60" : "text-gold/80",
              )}
            />
            {renderRegistrationSummary({
              registrationCount: fg.registrationCount,
              isRegistered: fg.isRegistered,
              isOnline,
              isLoading: fg.status === "checking",
            })}
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase border",
                fg.status === "ok"
                  ? "bg-brilliance/10 text-brilliance border-brilliance/30"
                  : fg.status === "fail"
                    ? "bg-danger/10 text-danger border-danger/30"
                    : "bg-gold/10 text-gold/50 border-gold/20",
              )}
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

            {isInteractive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnterFactoryGame(fg);
                }}
                className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 transition-all opacity-0 group-hover:opacity-100"
                title="Enter game"
              >
                <Play className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Categorize and sort factory games
  const categorizedFactoryGames = useMemo(() => {
    const online = factoryGames.filter((fg) => fg.status === "ok");
    const upcoming = online
      .filter((fg) => isUpcoming(fg.startMainAt))
      .toSorted((a, b) => (a.startMainAt as number) - (b.startMainAt as number));
    const ongoing = online
      .filter((fg) => isOngoing(fg.startMainAt, fg.endAt))
      .toSorted((a, b) => {
        if ((a.endAt === 0 || a.endAt == null) && (b.endAt === 0 || b.endAt == null)) {
          return (a.startMainAt as number) - (b.startMainAt as number);
        }
        if (a.endAt === 0 || a.endAt == null) return -1;
        if (b.endAt === 0 || b.endAt == null) return 1;
        return (a.endAt as number) - nowSec - ((b.endAt as number) - nowSec);
      });
    const ended = online
      .filter((fg) => isEnded(fg.startMainAt, fg.endAt))
      .toSorted((a, b) => (b.endAt as number) - (a.endAt as number));
    const unknown = online.filter((fg) => fg.startMainAt == null).toSorted((a, b) => a.name.localeCompare(b.name));

    return { ongoing, upcoming, ended, unknown };
  }, [factoryGames, isOngoing, isUpcoming, isEnded, nowSec]);

  return (
    <div className={cn("flex flex-col lg:flex-row gap-6", className)}>
      {/* Factory Games */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold/80">Factory Games</h3>
            {factoryLoading && <Loader2 className="w-4 h-4 text-gold/50 animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            {/* Chain toggle */}
            <div className="flex items-center gap-1 rounded-full border border-gold/20 bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => handleSwitchChain("mainnet")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full transition",
                  activeFactoryChain === "mainnet" ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold",
                )}
              >
                Mainnet
              </button>
              <button
                type="button"
                onClick={() => handleSwitchChain("slot")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full transition",
                  activeFactoryChain === "slot" ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold",
                )}
              >
                Slot
              </button>
            </div>
            <button
              onClick={() => void handleRefresh()}
              disabled={factoryLoading}
              className="p-1.5 rounded-md bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", factoryLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {factoryLoading && factoryGames.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gold/20 p-6 text-center">
              <Loader2 className="w-8 h-8 text-gold/50 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gold/60">Loading factory games...</p>
            </div>
          ) : factoryErrorMessage ? (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-danger/60 mx-auto mb-2" />
              <p className="text-sm text-danger">Failed to load games</p>
              <button
                onClick={() => void handleRefresh()}
                className="mt-2 px-3 py-1 text-xs rounded-md bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
              >
                Try Again
              </button>
            </div>
          ) : factoryGames.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gold/20 p-6 text-center">
              <Globe className="w-8 h-8 text-gold/30 mx-auto mb-2" />
              <p className="text-sm text-gold/60">No factory games found</p>
            </div>
          ) : (
            <>
              {categorizedFactoryGames.ongoing.length > 0 && (
                <>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/60 px-1">Ongoing</div>
                  {categorizedFactoryGames.ongoing.map(renderFactoryItem)}
                </>
              )}
              {categorizedFactoryGames.upcoming.length > 0 && (
                <>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/60 px-1 mt-3">
                    Upcoming
                  </div>
                  {categorizedFactoryGames.upcoming.map(renderFactoryItem)}
                </>
              )}
              {categorizedFactoryGames.ended.length > 0 && (
                <button
                  onClick={() => setShowEnded(!showEnded)}
                  className="flex items-center gap-2 w-full text-[10px] font-semibold uppercase tracking-widest text-gold/50 px-1 mt-3 hover:text-gold/70"
                >
                  Ended ({categorizedFactoryGames.ended.length}) {showEnded ? "^" : "v"}
                </button>
              )}
              {showEnded && categorizedFactoryGames.ended.map(renderFactoryItem)}
              {categorizedFactoryGames.unknown.length > 0 && (
                <button
                  onClick={() => setShowAwaiting(!showAwaiting)}
                  className="flex items-center gap-2 w-full text-[10px] font-semibold uppercase tracking-widest text-gold/50 px-1 mt-3 hover:text-gold/70"
                >
                  Awaiting Config ({categorizedFactoryGames.unknown.length}) {showAwaiting ? "^" : "v"}
                </button>
              )}
              {showAwaiting && categorizedFactoryGames.unknown.map(renderFactoryItem)}
            </>
          )}
        </div>
      </div>

      {/* Recent Games */}
      <div className="lg:w-80 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gold/80">Recent Games</h3>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {saved.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gold/20 p-6 text-center">
              <Globe className="w-8 h-8 text-gold/30 mx-auto mb-2" />
              <p className="text-sm text-gold/60">No recent games yet</p>
              <p className="text-[10px] text-gold/40 mt-1">Select a game to begin</p>
            </div>
          ) : (
            savedWorlds.map((world) => {
              const gameIsOnline = isGameOnline(world);
              const meta = savedWorldMeta[world.name];
              const gameIsEnded = gameIsOnline && isEnded(meta?.startMainAt ?? null, meta?.endAt ?? null);
              const isChainMatch = world.chain ? normalizeFactoryChain(world.chain) === activeFactoryChain : true;

              return (
                <div
                  key={world.name}
                  className={cn(
                    "group relative rounded-lg border p-3 transition-all duration-200 cursor-pointer",
                    selected === world.name
                      ? gameIsOnline
                        ? gameIsEnded
                          ? "border-gold/40 bg-black/40 opacity-70"
                          : "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                        : "border-danger/50 bg-danger/5"
                      : gameIsOnline
                        ? gameIsEnded
                          ? "border-gold/10 bg-black/30 hover:bg-black/40 opacity-60"
                          : "border-gold/20 bg-black/40 hover:bg-black/50 hover:border-gold/40"
                        : "border-danger/40 bg-danger/5 hover:bg-danger/10",
                  )}
                  onClick={() => {
                    setSelected(world.name);
                    setSelectedFactory(null);
                  }}
                  onDoubleClick={() => handleEnterGame(world)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("truncate font-bold text-sm", gameIsEnded ? "text-gold/50" : "text-gold")}>
                          {world.name}
                        </div>
                        {world.chain && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                              world.chain === "mainnet"
                                ? "border-brilliance/30 bg-brilliance/10 text-brilliance"
                                : "border-gold/30 bg-gold/10 text-gold/60",
                              isChainMatch ? "" : "opacity-60",
                            )}
                          >
                            {world.chain}
                          </span>
                        )}
                        {selected === world.name && (
                          <div className="flex-shrink-0 p-0.5 rounded-full bg-gold/20">
                            <Check className="w-3 h-3 text-gold" />
                          </div>
                        )}
                      </div>
                      {gameIsOnline && meta && (
                        <WorldCountdownDetailed
                          startMainAt={meta.startMainAt}
                          endAt={meta.endAt}
                          status={statusMap[world.name]}
                          className={cn("text-xs font-semibold block", gameIsEnded ? "text-gold/40" : "text-gold/80")}
                        />
                      )}
                      {renderRegistrationSummary({
                        registrationCount: meta?.registrationCount ?? null,
                        isRegistered: meta?.isRegistered ?? null,
                        isOnline: gameIsOnline,
                        isLoading: statusMap[world.name] === "checking",
                      })}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase border",
                          statusMap[world.name] === "ok"
                            ? "bg-brilliance/10 text-brilliance border-brilliance/30"
                            : statusMap[world.name] === "fail"
                              ? "bg-danger/10 text-danger border-danger/30"
                              : "bg-gold/10 text-gold/50 border-gold/20",
                        )}
                      >
                        {statusMap[world.name] === "ok" ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-brilliance animate-pulse" />
                            Online
                          </>
                        ) : statusMap[world.name] === "fail" ? (
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

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {gameIsOnline && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnterGame(world);
                            }}
                            className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 transition-all"
                            title="Enter game"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveWorld(world.name);
                          }}
                          className="p-1.5 rounded-md text-danger/60 hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/30"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(223, 170, 84, 0.05);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(223, 170, 84, 0.2);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(223, 170, 84, 0.4);
        }
      `}</style>
    </div>
  );
};
