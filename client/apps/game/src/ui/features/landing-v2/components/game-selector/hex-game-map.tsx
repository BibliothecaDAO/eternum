import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability, getAvailabilityStatus, getWorldKey } from "@/hooks/use-world-availability";
import { resolveChain } from "@/runtime/world";
import type { WorldSelectionInput } from "@/runtime/world";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Eye, Play, UserPlus, Users, RefreshCw, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Chain } from "@contracts";
import { env } from "../../../../../../env";

const normalizeFactoryChain = (chain: Chain): Chain => {
  if (chain === "slottest" || chain === "local") return "slot";
  return chain;
};

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
    // ignore
  }
  return null;
};

export type WorldSelection = WorldSelectionInput;

type GameStatus = "ongoing" | "upcoming" | "ended" | "unknown";

interface GameNode {
  name: string;
  chain: Chain;
  worldKey: string;
  status: "checking" | "ok" | "fail";
  gameStatus: GameStatus;
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isRegistered: boolean | null;
  // Position on the hex grid (we'll calculate this)
  gridX: number;
  gridY: number;
}

interface HexGameMapProps {
  chain: Chain;
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onRegister: (selection: WorldSelection) => void;
  className?: string;
}

/**
 * A single hexagon node representing a game world
 */
const HexNode = ({
  game,
  isSelected,
  onClick,
  onAction,
  playerAddress,
}: {
  game: GameNode;
  isSelected: boolean;
  onClick: () => void;
  onAction: (action: "play" | "spectate" | "register") => void;
  playerAddress: string | null;
}) => {
  const isOnline = game.status === "ok";
  const isOngoing = game.gameStatus === "ongoing";
  const isUpcoming = game.gameStatus === "upcoming";
  const isEnded = game.gameStatus === "ended";
  const canPlay = isOnline && isOngoing && game.isRegistered;
  const canRegister = isOnline && (isUpcoming || isOngoing) && !game.isRegistered;
  const canSpectate = isOnline && isOngoing;

  // Color based on status
  const hexColor = isEnded
    ? "from-gray-600/40 to-gray-800/40 border-gray-500/30"
    : isOngoing
      ? "from-gold/40 to-amber-700/40 border-gold/50"
      : isUpcoming
        ? "from-emerald-600/40 to-emerald-800/40 border-emerald-500/50"
        : "from-gray-600/30 to-gray-800/30 border-gray-500/20";

  const glowColor = isEnded
    ? ""
    : isOngoing
      ? "shadow-[0_0_20px_rgba(223,170,84,0.3)]"
      : isUpcoming
        ? "shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        : "";

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-300",
        isSelected && "scale-110 z-10",
        !isOnline && "opacity-50",
      )}
      onClick={onClick}
    >
      {/* Hexagon shape */}
      <div
        className={cn(
          "relative w-32 h-36 flex items-center justify-center",
          "clip-hexagon",
          "bg-gradient-to-b",
          hexColor,
          "border-2",
          isSelected && glowColor,
          "hover:scale-105 transition-transform",
        )}
        style={{
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        }}
      >
        {/* Inner content */}
        <div className="absolute inset-2 flex flex-col items-center justify-center text-center p-2">
          {/* Game name */}
          <div className={cn("text-xs font-bold truncate w-full", isOnline ? "text-gold" : "text-gray-400")}>
            {game.name.length > 12 ? `${game.name.slice(0, 10)}...` : game.name}
          </div>

          {/* Status indicator */}
          <div
            className={cn(
              "mt-1 text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full",
              isOngoing && "bg-gold/20 text-gold",
              isUpcoming && "bg-emerald-500/20 text-emerald-400",
              isEnded && "bg-gray-500/20 text-gray-400",
              game.gameStatus === "unknown" && "bg-gray-500/20 text-gray-500",
            )}
          >
            {isOngoing ? "Live" : isUpcoming ? "Soon" : isEnded ? "Ended" : "..."}
          </div>

          {/* Player count */}
          {game.registrationCount != null && (
            <div className="mt-1 flex items-center gap-1 text-[9px] text-gold/60">
              <Users className="w-3 h-3" />
              {game.registrationCount}
            </div>
          )}
        </div>

        {/* Selection ring */}
        {isSelected && (
          <div
            className="absolute inset-0 border-2 border-gold animate-pulse"
            style={{
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            }}
          />
        )}
      </div>

      {/* Action menu when selected */}
      {isSelected && isOnline && (
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {canSpectate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction("spectate");
              }}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
                "bg-black/80 border border-gold/30 text-gold/80",
                "hover:bg-gold/10 hover:text-gold transition-all",
              )}
              title="Watch the game"
            >
              <Eye className="w-3 h-3" />
              Spectate
            </button>
          )}
          {canRegister && playerAddress && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction("register");
              }}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
                "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400",
                "hover:bg-emerald-500/30 transition-all",
              )}
              title="Register for this game"
            >
              <UserPlus className="w-3 h-3" />
              Register
            </button>
          )}
          {canPlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction("play");
              }}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
                "bg-gold/20 border border-gold/50 text-gold",
                "hover:bg-gold/30 transition-all",
              )}
              title="Enter the game"
            >
              <Play className="w-3 h-3" />
              Play
            </button>
          )}
          {!playerAddress && (canRegister || canPlay) && (
            <div className="px-3 py-1.5 text-[10px] text-gold/50 bg-black/60 rounded-lg border border-gold/20">
              Connect wallet
            </div>
          )}
        </div>
      )}

      {/* Countdown tooltip when selected */}
      {isSelected && isOnline && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 border border-gold/30 rounded-lg px-3 py-1.5 z-20 whitespace-nowrap">
          <WorldCountdownDetailed
            startMainAt={game.startMainAt}
            endAt={game.endAt}
            status={game.status}
            className="text-xs font-semibold text-gold"
          />
        </div>
      )}
    </div>
  );
};

/**
 * Hex grid map for a single chain (Mainnet or Slot)
 */
export const HexGameMap = ({ chain, onSelectGame, onSpectate, onRegister, className }: HexGameMapProps) => {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [playerRegistration, setPlayerRegistration] = useState<Record<string, boolean | null>>({});

  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;

  const { isOngoing, isEnded, isUpcoming } = useGameTimeStatus();

  const resolvedChain = resolveChain(env.VITE_PUBLIC_CHAIN as Chain);
  const activeFactoryChain = normalizeFactoryChain(resolvedChain);
  const targetChain = normalizeFactoryChain(chain);

  const {
    worlds: factoryWorlds,
    isLoading: factoryWorldsLoading,
    error: factoryError,
    refetchAll: refetchFactoryWorlds,
  } = useFactoryWorlds([chain]);

  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchFactory,
  } = useWorldsAvailability(factoryWorlds, factoryWorlds.length > 0);

  // Fetch player registration status
  useEffect(() => {
    if (!playerFeltLiteral) return;
    let cancelled = false;

    const onlineWorlds = factoryWorlds.filter((world) => {
      const availability = factoryAvailability.get(getWorldKey(world));
      return availability?.isAvailable && !availability.isLoading;
    });

    const uniqueWorlds = onlineWorlds.filter((world) => {
      const key = getWorldKey(world);
      return playerRegistration[key] === undefined;
    });

    if (uniqueWorlds.length === 0) return;

    const run = async () => {
      for (const world of uniqueWorlds) {
        if (cancelled) break;
        const key = getWorldKey(world);
        const torii = buildToriiBaseUrl(world.name);
        const status = await fetchPlayerRegistrationStatus(torii, playerFeltLiteral);
        if (!cancelled) {
          setPlayerRegistration((prev) => ({ ...prev, [key]: status }));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [playerFeltLiteral, factoryWorlds, factoryAvailability, playerRegistration]);

  // Build game nodes with positions
  const gameNodes = useMemo<GameNode[]>(() => {
    const nodes = factoryWorlds
      .filter((world) => normalizeFactoryChain(world.chain) === targetChain)
      .map((world, index) => {
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

        // Calculate hex grid position (honeycomb layout)
        const col = index % 3;
        const row = Math.floor(index / 3);
        const gridX = col * 140 + (row % 2) * 70;
        const gridY = row * 110;

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
          gridX,
          gridY,
        };
      });

    // Sort: ongoing first, then upcoming, then ended, then unknown
    return nodes.toSorted((a, b) => {
      const order: Record<GameStatus, number> = { ongoing: 0, upcoming: 1, ended: 2, unknown: 3 };
      return order[a.gameStatus] - order[b.gameStatus];
    });
  }, [factoryWorlds, factoryAvailability, playerRegistration, targetChain, isOngoing, isEnded, isUpcoming]);

  const handleRefresh = useCallback(async () => {
    setPlayerRegistration({});
    await Promise.all([refetchFactoryWorlds(), refetchFactory()]);
  }, [refetchFactoryWorlds, refetchFactory]);

  const handleAction = useCallback(
    (game: GameNode, action: "play" | "spectate" | "register") => {
      const selection = { name: game.name, chain: game.chain };
      if (action === "play") {
        onSelectGame(selection);
      } else if (action === "spectate") {
        onSpectate(selection);
      } else if (action === "register") {
        onRegister(selection);
      }
    },
    [onSelectGame, onSpectate, onRegister],
  );

  const isLoading = factoryWorldsLoading || factoryCheckingAvailability;
  const isChainMatch = targetChain === activeFactoryChain;

  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3
            className={cn(
              "text-lg font-bold uppercase tracking-wider",
              chain === "mainnet" ? "text-brilliance" : "text-gold",
            )}
          >
            {chain === "mainnet" ? "Mainnet" : "Slot"}
          </h3>
          {!isChainMatch && (
            <span className="text-[10px] text-gold/50 px-2 py-0.5 rounded border border-gold/20">Different chain</span>
          )}
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={isLoading}
          className="p-1.5 rounded-md bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gold/60" />
          <span className="text-gold/70">Ongoing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          <span className="text-gold/70">Upcoming</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-500/60" />
          <span className="text-gold/70">Ended</span>
        </div>
      </div>

      {/* Hex grid */}
      <div className="relative min-h-[300px] overflow-visible">
        {isLoading && gameNodes.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="w-8 h-8 text-gold/50 animate-spin" />
          </div>
        ) : factoryError ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <p className="text-sm text-danger">Failed to load games</p>
            <button
              onClick={() => void handleRefresh()}
              className="mt-2 px-3 py-1 text-xs rounded-md bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
            >
              Retry
            </button>
          </div>
        ) : gameNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <p className="text-sm text-gold/60">No games on {chain}</p>
          </div>
        ) : (
          <div
            className="relative flex flex-wrap gap-4 justify-center items-start pb-20"
            onClick={() => setSelectedGame(null)}
          >
            {gameNodes.map((game) => (
              <HexNode
                key={game.worldKey}
                game={game}
                isSelected={selectedGame === game.worldKey}
                onClick={() => setSelectedGame(selectedGame === game.worldKey ? null : game.worldKey)}
                onAction={(action) => handleAction(game, action)}
                playerAddress={playerAddress}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
