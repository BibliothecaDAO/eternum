import { ReactComponent as Invite } from "@/assets/icons/common/envelope.svg";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getAvatarUrl } from "@/hooks/use-player-avatar";
import { ENABLE_LEADERBOARD_EFFECTS_MOCKUP } from "@/ui/constants";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { RegisterPointsButton } from "../components/register-points-button";
import type { PlayerActivityBreakdown } from "@/services/leaderboard/player-activity-breakdown-service";
import { ContractAddress, GuildInfo, PlayerInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import gsap from "gsap";
import User from "lucide-react/dist/esm/icons/user";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { LeaderboardEffectsOverlay } from "./leaderboard-effects";
import { PlayerEffect, useLeaderboardEffects } from "./use-leaderboard-effects";

const COUNT_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ROW_HEIGHT = 44; // Approximate row height in pixels

export interface PlayerCustom extends PlayerInfo {
  structures: string[];
  isUser: boolean;
  isInvited: boolean;
  guild: GuildInfo | undefined;
  activityBreakdown: PlayerActivityBreakdown | null;
  includesLiveShareholderPoints: boolean;
}

interface PlayerListProps {
  players: PlayerCustom[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
}

interface PlayerWithActivityStats extends PlayerCustom {
  tilesExplored: number;
  tilesExploredPoints: number;
  cratesOpened: number;
  cratesOpenedPoints: number;
  riftsTaken: number;
  riftsTakenPoints: number;
  hyperstructuresTaken: number;
  hyperstructuresTakenPoints: number;
  hyperstructuresHeld: number;
  hyperstructuresHeldPoints: number;
}

const formatActivityValue = (count: number, points: number): string => {
  if (count > 0 && points > 0) {
    return `${COUNT_FORMATTER.format(count)} · ${currencyIntlFormat(points)} pts`;
  }

  if (count > 0) return COUNT_FORMATTER.format(count);
  if (points > 0) return `${currencyIntlFormat(points)} pts`;
  return "—";
};

const resolvePlayerActivityStats = (player: PlayerCustom): PlayerWithActivityStats => {
  const activity = player.activityBreakdown;

  return {
    ...player,
    tilesExplored: activity?.exploration.count ?? 0,
    tilesExploredPoints: activity?.exploration.points ?? 0,
    cratesOpened: activity?.openRelicChest.count ?? 0,
    cratesOpenedPoints: activity?.openRelicChest.points ?? 0,
    riftsTaken: activity?.otherStructureBanditsDefeat.count ?? 0,
    riftsTakenPoints: activity?.otherStructureBanditsDefeat.points ?? 0,
    hyperstructuresTaken: activity?.hyperStructureBanditsDefeat.count ?? 0,
    hyperstructuresTakenPoints: activity?.hyperStructureBanditsDefeat.points ?? 0,
    hyperstructuresHeld: player.hyperstructures,
    hyperstructuresHeldPoints: activity?.hyperstructureShare.points ?? 0,
  };
};

export const PlayerList = ({ players, viewPlayerInfo, whitelistPlayer, isLoading }: PlayerListProps) => {
  const [selectedPlayerAddress, setSelectedPlayerAddress] = useState<string | null>(null);
  const mode = useGameModeConfig();
  const showTribeDetails = mode.ui.showGuildsTab;
  const [prevPositions, setPrevPositions] = useState<Map<string, number>>(new Map());
  const leaderboardGridTemplate = useMemo(
    () =>
      showTribeDetails
        ? "grid-cols-[68px_minmax(0,_1.25fr)_minmax(0,_1.1fr)_minmax(0,_0.8fr)_minmax(0,_0.8fr)_minmax(0,_0.85fr)_minmax(0,_0.9fr)_minmax(0,_0.95fr)_minmax(0,_1fr)]"
        : "grid-cols-[68px_minmax(0,_1.7fr)_minmax(0,_0.9fr)_minmax(0,_0.9fr)_minmax(0,_0.95fr)_minmax(0,_0.95fr)_minmax(0,_1.05fr)_minmax(0,_1.1fr)]",
    [showTribeDetails],
  );

  useEffect(() => {
    if (!selectedPlayerAddress) {
      return;
    }

    const stillVisible = players.some((player) => String(player.address) === selectedPlayerAddress);

    if (!stillVisible) {
      setSelectedPlayerAddress(null);
    }
  }, [players, selectedPlayerAddress]);

  const playersWithActivityStats = useMemo(() => players.map(resolvePlayerActivityStats), [players]);

  const filteredPlayers = useMemo(
    () =>
      playersWithActivityStats.filter(
        (player) => !player.name.includes("Daydreams") && !player.name.includes("Central Bank"),
      ),
    [playersWithActivityStats],
  );

  // The leaderboard is always ranked — no column sorting. Sort ascending by the
  // resolved leaderboard rank so #1 is on top.
  const sortedPlayers = useMemo(() => {
    return filteredPlayers.toSorted((a, b) => a.rank - b.rank);
  }, [filteredPlayers]);

  // Leaderboard effects for animations
  const { effects, rowRefs } = useLeaderboardEffects(filteredPlayers, ENABLE_LEADERBOARD_EFFECTS_MOCKUP);

  // FLIP animation for row reordering
  useLayoutEffect(() => {
    if (prevPositions.size === 0) {
      // First render - just store positions
      const newPositions = new Map<string, number>();
      sortedPlayers.forEach((p, i) => newPositions.set(String(p.address), i));
      setPrevPositions(newPositions);
      return;
    }

    // Animate rows from old position to new
    sortedPlayers.forEach((player, index) => {
      const address = String(player.address);
      const prevIndex = prevPositions.get(address);

      if (prevIndex !== undefined && prevIndex !== index) {
        const rowEl = rowRefs.current.get(address.toLowerCase());
        if (rowEl) {
          const deltaY = (prevIndex - index) * ROW_HEIGHT;
          gsap.fromTo(rowEl, { y: deltaY }, { y: 0, duration: 0.4, ease: "power2.out" });
        }
      }
    });

    // Store current positions for next comparison
    const newPositions = new Map<string, number>();
    sortedPlayers.forEach((p, i) => newPositions.set(String(p.address), i));
    setPrevPositions(newPositions);
  }, [sortedPlayers, rowRefs]);

  const handleSelectPlayer = (address: PlayerCustom["address"]) => {
    const normalized = String(address);

    setSelectedPlayerAddress(normalized);
    viewPlayerInfo(ContractAddress(normalized));
  };

  // Register row ref callback
  const registerRowRef = useCallback(
    (address: string, el: HTMLDivElement | null) => {
      const normalizedAddress = address.toLowerCase();
      if (el) {
        rowRefs.current.set(normalizedAddress, el);
      } else {
        rowRefs.current.delete(normalizedAddress);
      }
    },
    [rowRefs],
  );

  return (
    <div className="flex flex-col h-full">
      <PlayerListHeader showTribeDetails={showTribeDetails} gridTemplateClass={leaderboardGridTemplate} />

      <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent flex-1">
        {sortedPlayers.length > 0 ? (
          sortedPlayers.map((player) => {
            const normalizedAddress = String(player.address);
            const playerEffect = effects.get(normalizedAddress.toLowerCase());
            const avatarUrl = getAvatarUrl(String(player.address));

            return (
              <PlayerRow
                key={normalizedAddress}
                player={player}
                avatarUrl={avatarUrl}
                onSelect={() => handleSelectPlayer(player.address)}
                whitelistPlayer={whitelistPlayer}
                isLoading={isLoading}
                showTribeDetails={showTribeDetails}
                gridTemplateClass={leaderboardGridTemplate}
                isSelected={selectedPlayerAddress === normalizedAddress}
                effect={playerEffect}
                registerRef={(el) => registerRowRef(normalizedAddress, el)}
              />
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gold/60">
            <User className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No players found</p>
          </div>
        )}
      </div>

      {/* Effects overlay - rendered via portal */}
      <LeaderboardEffectsOverlay effects={effects} rowRefs={rowRefs} showTribeDetails={showTribeDetails} />
    </div>
  );
};

const PlayerListHeader = ({
  showTribeDetails,
  gridTemplateClass,
}: {
  showTribeDetails: boolean;
  gridTemplateClass: string;
}) => {
  const columns = useMemo(() => {
    const params: Array<{ label: string; align: string }> = [
      { label: "Rank", align: "justify-center text-center" },
      { label: "Name", align: "justify-start text-left" },
    ];

    if (showTribeDetails) {
      params.push({ label: "Tribe", align: "justify-start text-left" });
    }

    params.push(
      { label: "Tiles", align: "justify-center text-center" },
      { label: "Crates", align: "justify-center text-center" },
      { label: "Rifts/Camps", align: "justify-center text-center" },
      { label: "HS Taken", align: "justify-center text-center" },
      { label: "HS Held", align: "justify-center text-center" },
      { label: "Points", align: "justify-center text-center" },
    );

    return params;
  }, [showTribeDetails]);

  return (
    // Solid opaque background + z-20 so the sticky header never shows the rows
    // bleeding through as it scrolls under it.
    <div
      className={clsx(
        "grid gap-x-4 items-center py-3 px-4 border-b border-gold/25 sticky top-0 z-20 bg-[#1a1410]",
        gridTemplateClass,
      )}
    >
      {columns.map(({ label, align }) => (
        <div
          key={label}
          className={clsx(
            "flex w-full items-center text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-gold/70",
            align,
          )}
        >
          {label}
        </div>
      ))}
    </div>
  );
};

const PlayerRow = ({
  player,
  avatarUrl,
  onSelect,
  whitelistPlayer,
  isLoading,
  showTribeDetails,
  gridTemplateClass,
  isSelected,
  effect,
  registerRef,
}: {
  player: PlayerWithActivityStats;
  avatarUrl: string | null;
  onSelect: () => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
  showTribeDetails: boolean;
  gridTemplateClass: string;
  isSelected: boolean;
  effect?: PlayerEffect;
  registerRef: (el: HTMLDivElement | null) => void;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const isUnranked = player.rank === Number.MAX_SAFE_INTEGER;
  const tilesLabel = formatActivityValue(player.tilesExplored, player.tilesExploredPoints);
  const cratesLabel = formatActivityValue(player.cratesOpened, player.cratesOpenedPoints);
  const riftsLabel = formatActivityValue(player.riftsTaken, player.riftsTakenPoints);
  const hyperstructuresTakenLabel = formatActivityValue(player.hyperstructuresTaken, player.hyperstructuresTakenPoints);
  const hyperstructuresHeldLabel = formatActivityValue(player.hyperstructuresHeld, player.hyperstructuresHeldPoints);
  const hasShareholderPoints = Boolean(player.includesLiveShareholderPoints);

  // Determine row glow based on effect
  const hasRankUp = effect && effect.rankChange < 0;
  const hasRankDown = effect && effect.rankChange > 0;

  return (
    <div
      ref={registerRef}
      className={clsx(
        "relative flex w-full mb-1 overflow-visible rounded-lg border border-transparent bg-dark/40 backdrop-blur-sm transition-all duration-200",
        player.isUser && !isSelected && "border-gold/50 bg-gold/20",
        !isSelected && !hasRankUp && !hasRankDown && "hover:border-gold/20 hover:bg-brown/40",
        isSelected && "border-amber-300/80 bg-amber-400/20 shadow-[0_0_14px_rgba(223,170,84,0.45)]",
        hasRankUp && "animate-row-glow-up",
        hasRankDown && "animate-row-glow-down",
      )}
    >
      {(player.isUser || isSelected) && (
        <span
          className={clsx(
            "pointer-events-none absolute inset-y-2 left-1 w-1 rounded-full bg-gradient-to-b",
            player.isUser && !isSelected && "from-amber-200 via-gold to-amber-500 opacity-80",
            isSelected && "from-yellow via-amber-200 to-gold opacity-100 animate-slowPulse",
          )}
        />
      )}
      <div
        className={clsx(
          "grid w-full cursor-pointer items-center gap-x-4 px-4 py-2 text-xs transition-colors",
          gridTemplateClass,
        )}
        onClick={onSelect}
      >
        <div className="flex justify-center">
          <span
            className={clsx(
              "font-medium transition-colors",
              !isUnranked && "italic",
              isUnranked ? "text-red-400" : isSelected ? "text-lightest" : "text-gold/90",
            )}
          >
            {isUnranked ? " - " : `#${player.rank}`}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {avatarUrl && (
            <img
              className="h-7 w-7 rounded-full border border-gold/30 object-cover"
              src={avatarUrl}
              alt={`${player.name} avatar`}
            />
          )}
          <h6
            className={clsx("truncate text-sm font-semibold transition-colors", {
              "text-lightest": isSelected,
              "text-gold": !isSelected,
            })}
          >
            {player.name}
          </h6>
          {player.isUser && (
            <span className="shrink-0 rounded-full border border-amber-200/50 bg-amber-200/20 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-amber-200">
              You
            </span>
          )}
          {isSelected && (
            <span className="shrink-0 rounded-full border border-amber-300/70 bg-amber-300/20 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-amber-200">
              Viewing
            </span>
          )}
        </div>
        {showTribeDetails ? (
          <div
            className={clsx("min-w-0 truncate text-xs transition-colors", {
              "text-emerald-300/90": player.guild && !isSelected,
              "text-emerald-200": player.guild && isSelected,
              "text-gold/50 italic": !player.guild && !isSelected,
              "text-gold/70 italic": !player.guild && isSelected,
            })}
          >
            {player.guild ? player.guild.name : "No Tribe"}
          </div>
        ) : null}
        <div
          className={clsx("flex justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {tilesLabel}
        </div>
        <div
          className={clsx("flex justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {cratesLabel}
        </div>
        <div
          className={clsx("flex justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {riftsLabel}
        </div>
        <div
          className={clsx("flex justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {hyperstructuresTakenLabel}
        </div>
        <div
          className={clsx("flex justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {hyperstructuresHeldLabel}
        </div>
        <div
          className={clsx("flex items-center justify-center gap-2 text-sm font-semibold", {
            "text-amber-200": player.points > 1000,
            "text-lightest": isSelected && player.points <= 1000,
            "text-gold/90": !isSelected && player.points <= 1000,
          })}
        >
          <span>{currencyIntlFormat(player.points)}</span>
          {hasShareholderPoints && (
            <span
              className="text-order-brilliance text-xs"
              onMouseEnter={() =>
                setTooltip({
                  content: <div className="text-gold">Includes real-time hyperstructure shareholder points</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              ⚡
            </span>
          )}
          {player.isUser && (
            // Register unregistered shareholder points straight from the row.
            // Don't let the click bubble up to the row-select handler.
            <span onClick={(event) => event.stopPropagation()}>
              <RegisterPointsButton variant="inline" />
            </span>
          )}
        </div>
      </div>

      {showTribeDetails ? (
        <div className="flex items-center pr-2 min-w-[28px] justify-center">
          {!player.isUser && (
            <Invite
              onClick={() => {
                whitelistPlayer(player.address);
                setTooltip(null);
              }}
              className={clsx("w-5 h-5 fill-gold hover:fill-amber-400 transition-all duration-200", {
                "animate-pulse opacity-50 pointer-events-none": isLoading,
                "cursor-pointer": !isLoading,
              })}
              onMouseEnter={() =>
                setTooltip({
                  content: <div className="text-gold">Invite to tribe</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};
