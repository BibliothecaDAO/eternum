import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import {
  useWorldsAvailability,
  getAvailabilityStatus,
  getWorldKey,
  type WorldConfigMeta,
} from "@/hooks/use-world-availability";
import { useWorldRegistration, type RegistrationStage } from "@/hooks/use-world-registration";
import type { WorldSelectionInput } from "@/runtime/world";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Eye, Play, UserPlus, Users, RefreshCw, Loader2, CheckCircle2, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Chain } from "@contracts";

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

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

const fetchPlayerRegistrationStatus = async (
  toriiBaseUrl: string,
  playerLiteral: string | null,
): Promise<boolean | null> => {
  if (!playerLiteral) {
    console.log("[fetchPlayerRegistrationStatus] No playerLiteral provided");
    return null;
  }
  try {
    const query = `SELECT registered FROM "s1_eternum-BlitzRealmPlayerRegister" WHERE player = "${playerLiteral}" LIMIT 1;`;
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    console.log("[fetchPlayerRegistrationStatus] Checking registration:", {
      playerLiteral,
      toriiBaseUrl,
      query,
      url,
    });
    const response = await fetch(url);
    if (!response.ok) {
      console.log("[fetchPlayerRegistrationStatus] Response not ok:", response.status, response.statusText);
      return null;
    }
    const data = (await response.json()) as Record<string, unknown>[];
    console.log("[fetchPlayerRegistrationStatus] Response data:", data);
    const [row] = data;
    if (row && row.registered != null) {
      const result = parseMaybeBool(row.registered);
      console.log("[fetchPlayerRegistrationStatus] Parsed result:", result);
      return result;
    }
    console.log("[fetchPlayerRegistrationStatus] No registration found");
  } catch (error) {
    console.error("[fetchPlayerRegistrationStatus] Error:", error);
  }
  return null;
};

/**
 * Format fee amount from wei to human-readable LORDS
 */
const formatFeeAmount = (amount: bigint): string => {
  const divisor = 10n ** 18n;
  const whole = amount / divisor;
  const remainder = amount % divisor;
  if (remainder === 0n) return whole.toString();
  const decimal = (remainder * 100n) / divisor;
  if (decimal === 0n) return whole.toString();
  return `${whole}.${decimal.toString().padStart(2, "0")}`;
};

/**
 * Get stage label for registration progress
 */
const getStageLabel = (stage: RegistrationStage): string => {
  switch (stage) {
    case "obtaining-token":
      return "Obtaining token...";
    case "waiting-for-token":
      return "Confirming...";
    case "registering":
      return "Registering...";
    case "done":
      return "Registered!";
    case "error":
      return "Failed";
    default:
      return "Register";
  }
};

/**
 * Game type badge - Ranked (MMR enabled) or Sandbox
 */
const GameTypeBadge = ({ mmrEnabled }: { mmrEnabled: boolean }) => {
  if (mmrEnabled) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-orange border border-orange/40 bg-orange/15 px-1 py-0.5 rounded">
        <Trophy className="w-2.5 h-2.5" />
        Ranked
      </span>
    );
  }
  return <span className="text-[8px] text-gold/50 border border-gold/20 bg-gold/5 px-1 py-0.5 rounded">Sandbox</span>;
};

/**
 * Chain badge - shows which network the game is on
 */
const ChainBadge = ({ chain }: { chain: Chain }) => {
  const isMainnet = chain === "mainnet";
  return (
    <span
      className={cn(
        "text-[8px] font-medium px-1 py-0.5 rounded",
        isMainnet
          ? "text-brilliance/70 bg-brilliance/10 border border-brilliance/20"
          : "text-gold/70 bg-gold/10 border border-gold/20",
      )}
    >
      {isMainnet ? "Mainnet" : "Slot"}
    </span>
  );
};

export type WorldSelection = WorldSelectionInput;

type GameStatus = "ongoing" | "upcoming" | "ended" | "unknown";

interface GameData {
  name: string;
  chain: Chain;
  worldKey: string;
  status: "checking" | "ok" | "fail";
  gameStatus: GameStatus;
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isRegistered: boolean | null;
  config: WorldConfigMeta | null;
}

interface GameCardProps {
  game: GameData;
  onPlay: () => void;
  onSpectate: () => void;
  onRegistrationComplete?: (worldKey: string) => void;
  playerAddress: string | null;
  showChainBadge?: boolean;
}

/**
 * Single game card component with inline registration
 */
const GameCard = ({
  game,
  onPlay,
  onSpectate,
  onRegistrationComplete,
  playerAddress,
  showChainBadge = false,
}: GameCardProps) => {
  const isOngoing = game.gameStatus === "ongoing";
  const isUpcoming = game.gameStatus === "upcoming";
  const isEnded = game.gameStatus === "ended";
  const devModeOn = game.config?.devModeOn ?? false;
  const canPlay = isOngoing && game.isRegistered;
  // Can spectate ongoing or ended games
  const canSpectate = isOngoing || isEnded;
  // Can register during upcoming, or during ongoing if dev mode is on
  const canRegisterPeriod = isUpcoming || (isOngoing && devModeOn);

  // Inline registration hook
  const { register, registrationStage, isRegistering, error, feeAmount, canRegister } = useWorldRegistration({
    worldName: game.name,
    chain: game.chain,
    config: game.config,
    isRegistered: game.isRegistered === true,
    enabled: game.status === "ok" && canRegisterPeriod,
  });

  // Handle registration with toast notification
  const handleRegister = useCallback(async () => {
    try {
      await register();
    } catch (err) {
      console.error("Registration failed:", err);
    }
  }, [register]);

  // Show success toast when registration completes
  useEffect(() => {
    if (registrationStage === "done") {
      toast.success("Registration successful!", {
        description: `You are now registered for ${game.name}`,
      });
      onRegistrationComplete?.(game.worldKey);
    }
  }, [registrationStage, game.name, game.worldKey, onRegistrationComplete]);

  // Status colors - enhanced yellow for upcoming
  const statusColors = {
    ongoing: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/50",
    upcoming: "from-amber-500/30 to-yellow-600/15 border-amber-400/60",
    ended: "from-gray-500/20 to-gray-600/10 border-gray-500/30",
    unknown: "from-gray-500/20 to-gray-600/10 border-gray-500/30",
  };

  const statusBadgeColors = {
    ongoing: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    upcoming: "bg-amber-500/30 text-amber-200 border-amber-400/60",
    ended: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    unknown: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  };

  const showRegistered = game.isRegistered || registrationStage === "done";

  return (
    <div
      className={cn(
        "relative group rounded-lg border bg-gradient-to-b backdrop-blur-sm",
        "transition-all duration-200 hover:scale-[1.01] hover:shadow-md",
        statusColors[game.gameStatus],
        isOngoing && "shadow-emerald-500/10",
        isUpcoming && "shadow-amber-500/10",
        showRegistered && "ring-1 ring-emerald-400/50",
      )}
    >
      {/* Registered indicator - top banner */}
      {showRegistered && (
        <div className="absolute -top-px left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-b-full" />
      )}

      <div className="p-3 space-y-2">
        {/* Header: Name + Badges */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-white text-sm truncate flex-1" title={game.name}>
            {game.name}
          </h3>
          <div className="flex items-center gap-1">
            {showChainBadge && <ChainBadge chain={game.chain} />}
            {game.config && <GameTypeBadge mmrEnabled={game.config.mmrEnabled} />}
            <span
              className={cn(
                "flex-shrink-0 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border",
                statusBadgeColors[game.gameStatus],
              )}
            >
              {isOngoing ? "Live" : isUpcoming ? "Soon" : isEnded ? "Ended" : "..."}
            </span>
          </div>
        </div>

        {/* Stats row with registration indicator */}
        <div className="flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{game.registrationCount ?? 0} players</span>
          </div>
          {showRegistered && (
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium">Registered</span>
            </div>
          )}
        </div>

        {/* Countdown - compact */}
        <div className="py-1.5 px-2 bg-black/20 rounded text-xs">
          <WorldCountdownDetailed
            startMainAt={game.startMainAt}
            endAt={game.endAt}
            status={game.status}
            className="text-xs text-white/70"
          />
        </div>

        {/* Action buttons - compact: [Play/Register] [Spectate] layout */}
        <div className="flex gap-1.5">
          {/* Left slot: Play OR Register (share same space) */}
          {canPlay ? (
            <button
              onClick={onPlay}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                "bg-emerald-500 text-white hover:bg-emerald-400 transition-colors",
              )}
            >
              <Play className="w-3 h-3" />
              Play
            </button>
          ) : !showRegistered && canRegisterPeriod && playerAddress ? (
            <>
              {isRegistering ? (
                <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-gold/10 text-gold border border-gold/30">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {getStageLabel(registrationStage)}
                </div>
              ) : registrationStage === "error" ? (
                <button
                  onClick={handleRegister}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                >
                  Retry
                </button>
              ) : canRegister ? (
                <button
                  onClick={handleRegister}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                    "bg-brilliance/20 text-brilliance border border-brilliance/30 hover:bg-brilliance/30 transition-colors",
                  )}
                >
                  <UserPlus className="w-3 h-3" />
                  Register
                </button>
              ) : null}
            </>
          ) : !playerAddress && !showRegistered && canRegisterPeriod ? (
            <div className="flex-1 text-center text-[10px] text-white/40 py-1">Connect wallet</div>
          ) : null}

          {/* Right slot: Spectate (always in same position) */}
          {canSpectate && (
            <button
              onClick={onSpectate}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium",
                "bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10",
              )}
            >
              <Eye className="w-3 h-3" />
              Spectate
            </button>
          )}
        </div>

        {/* Fee info (shown when can register) */}
        {canRegister && feeAmount > 0n && !isRegistering && (
          <div className="text-[10px] text-gold/50 text-center">Fee: {formatFeeAmount(feeAmount)} LORDS</div>
        )}

        {/* Error message - only show if not already registered */}
        {registrationStage === "error" && error && !showRegistered && (
          <div className="text-[10px] text-red-400 text-center truncate" title={error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

interface UnifiedGameGridProps {
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onRegistrationComplete?: () => void;
  className?: string;
}

/**
 * Unified game grid - combines games from mainnet and slot into a single view
 */
export const UnifiedGameGrid = ({
  onSelectGame,
  onSpectate,
  onRegistrationComplete,
  className,
}: UnifiedGameGridProps) => {
  const [playerRegistration, setPlayerRegistration] = useState<Record<string, boolean | null>>({});

  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;

  // Debug log for player address conversion
  useEffect(() => {
    console.log("[UnifiedGameGrid] Player address info:", {
      rawAccountAddress: account?.address,
      playerAddress,
      playerFeltLiteral,
    });
  }, [account?.address, playerAddress, playerFeltLiteral]);

  const { isOngoing, isEnded, isUpcoming } = useGameTimeStatus();

  // Fetch from both chains
  const {
    worlds: factoryWorlds,
    isLoading: factoryWorldsLoading,
    error: factoryError,
    refetchAll: refetchFactoryWorlds,
  } = useFactoryWorlds(["mainnet", "slot"]);

  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchFactory,
  } = useWorldsAvailability(factoryWorlds, factoryWorlds.length > 0);

  // Fetch player registration status - use ref to track what's been checked to avoid infinite loops
  const checkedWorldsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!playerFeltLiteral) return;
    let cancelled = false;

    const onlineWorlds = factoryWorlds.filter((world) => {
      const availability = factoryAvailability.get(getWorldKey(world));
      return availability?.isAvailable && !availability.isLoading;
    });

    // Use ref to track checked worlds instead of state (avoids re-triggering effect)
    const uniqueWorlds = onlineWorlds.filter((world) => {
      const key = getWorldKey(world);
      return !checkedWorldsRef.current.has(key);
    });

    if (uniqueWorlds.length === 0) return;

    console.log(
      "[UnifiedGameGrid] uniqueWorlds to check registration:",
      uniqueWorlds.map((w) => ({ name: w.name, chain: w.chain })),
    );

    const run = async () => {
      // Batch all results and update state once at the end
      const results: Record<string, boolean | null> = {};

      for (const world of uniqueWorlds) {
        if (cancelled) break;
        const key = getWorldKey(world);
        // Mark as checked immediately to prevent re-checking
        checkedWorldsRef.current.add(key);

        console.log("[UnifiedGameGrid] Checking registration for world:", {
          worldName: world.name,
          chain: world.chain,
          key,
        });
        const torii = buildToriiBaseUrl(world.name);
        const status = await fetchPlayerRegistrationStatus(torii, playerFeltLiteral);
        results[key] = status;
      }

      // Update state once with all results
      if (!cancelled && Object.keys(results).length > 0) {
        setPlayerRegistration((prev) => ({ ...prev, ...results }));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [playerFeltLiteral, factoryWorlds, factoryAvailability]); // Removed playerRegistration from deps!

  // Build game data - only include online games from both chains
  const games = useMemo<GameData[]>(() => {
    const nodes = factoryWorlds
      .map((world) => {
        const worldKey = getWorldKey(world);
        const availability = factoryAvailability.get(worldKey);
        const status = getAvailabilityStatus(availability);
        const startMainAt = availability?.meta?.startMainAt ?? null;
        const endAt = availability?.meta?.endAt ?? null;

        let gameStatus: GameStatus = "unknown";
        if (status === "ok") {
          if (isEnded(startMainAt, endAt)) gameStatus = "ended";
          else if (isOngoing(startMainAt, endAt)) gameStatus = "ongoing";
          else if (isUpcoming(startMainAt)) gameStatus = "upcoming";
        }

        return {
          name: world.name,
          chain: world.chain,
          worldKey,
          status,
          gameStatus,
          startMainAt,
          endAt,
          registrationCount: availability?.meta?.registrationCount ?? null,
          isRegistered: playerRegistration[worldKey] ?? null,
          config: availability?.meta ?? null,
        };
      })
      // Only show online games
      .filter((game) => game.status === "ok");

    // Sort: live first, then upcoming (by start time asc), then ended (by start time asc)
    return nodes.toSorted((a, b) => {
      const order: Record<GameStatus, number> = { ongoing: 0, upcoming: 1, ended: 2, unknown: 3 };
      const statusDiff = order[a.gameStatus] - order[b.gameStatus];
      if (statusDiff !== 0) return statusDiff;
      // Within same status, sort by start time ascending
      const aStart = a.startMainAt ?? Infinity;
      const bStart = b.startMainAt ?? Infinity;
      return aStart - bStart;
    });
  }, [factoryWorlds, factoryAvailability, playerRegistration, isOngoing, isEnded, isUpcoming]);

  const handleRefresh = useCallback(async () => {
    setPlayerRegistration({});
    checkedWorldsRef.current.clear(); // Reset checked worlds on refresh
    await Promise.all([refetchFactoryWorlds(), refetchFactory()]);
  }, [refetchFactoryWorlds, refetchFactory]);

  // Callback for when a registration completes - update that specific game's status
  const handleRegistrationComplete = useCallback(
    (worldKey: string) => {
      setPlayerRegistration((prev) => ({ ...prev, [worldKey]: true }));
      onRegistrationComplete?.();
    },
    [onRegistrationComplete],
  );

  const isLoading = factoryWorldsLoading || factoryCheckingAvailability;

  // Count by status
  const counts = useMemo(() => {
    return {
      ongoing: games.filter((g) => g.gameStatus === "ongoing").length,
      upcoming: games.filter((g) => g.gameStatus === "upcoming").length,
      ended: games.filter((g) => g.gameStatus === "ended").length,
    };
  }, [games]);

  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold uppercase tracking-wider text-gold">Games</h3>
          <span className="text-xs text-white/40">
            {games.length} game{games.length !== 1 ? "s" : ""} online
          </span>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={isLoading}
          className="p-1.5 rounded-md bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Legend - compact */}
      <div className="flex items-center gap-3 mb-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-white/50">Live ({counts.ongoing})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-white/50">Soon ({counts.upcoming})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-white/50">Ended ({counts.ended})</span>
        </div>
      </div>

      {/* Game cards - scrollable */}
      <div className="max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {isLoading && games.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
              <span className="text-xs text-white/40">Checking games...</span>
            </div>
          </div>
        ) : factoryError ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <p className="text-xs text-red-400">Failed to load games</p>
            <button
              onClick={() => void handleRefresh()}
              className="mt-2 px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <p className="text-xs text-white/40">No games available</p>
            <p className="text-[10px] text-white/30 mt-1">Games appear when servers are online</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {games.map((game) => (
              <GameCard
                key={game.worldKey}
                game={game}
                onPlay={() => onSelectGame({ name: game.name, chain: game.chain })}
                onSpectate={() => onSpectate({ name: game.name, chain: game.chain })}
                onRegistrationComplete={handleRegistrationComplete}
                playerAddress={playerAddress}
                showChainBadge={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
