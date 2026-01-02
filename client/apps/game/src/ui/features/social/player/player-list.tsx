import { ReactComponent as Invite } from "@/assets/icons/common/envelope.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ENABLE_LEADERBOARD_EFFECTS_MOCKUP } from "@/ui/constants";
import { SortButton, SortInterface } from "@/ui/design-system/atoms/sort-button";
import { SortPanel } from "@/ui/design-system/molecules/sort-panel";
import { type LandingLeaderboardEntry } from "@/ui/features/landing/lib/landing-leaderboard-service";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { getIsBlitz } from "@bibliothecadao/eternum";
import { ContractAddress, GuildInfo, PlayerInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import gsap from "gsap";
import { User } from "lucide-react";
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
  leaderboardEntry?: LandingLeaderboardEntry | null;
}

interface PlayerListProps {
  players: PlayerCustom[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
}

interface PlayerWithStats extends PlayerCustom {
  leaderboardEntry: LandingLeaderboardEntry | null;
  leaderboardRank: number;
  leaderboardPoints: number;
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

const formatActivityValue = (count?: number | null, points?: number | null): string => {
  const hasCount = typeof count === "number" && count > 0;
  const hasPoints = typeof points === "number" && points > 0;

  if (hasCount && hasPoints) {
    return `${COUNT_FORMATTER.format(count!)} · ${currencyIntlFormat(points!, 0)} pts`;
  }

  if (hasCount) {
    return COUNT_FORMATTER.format(count!);
  }

  if (hasPoints) {
    return `${currencyIntlFormat(points!, 0)} pts`;
  }

  return "—";
};

export const PlayerList = ({ players, viewPlayerInfo, whitelistPlayer, isLoading }: PlayerListProps) => {
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "leaderboardRank",
    sort: "asc",
  });
  const [selectedPlayerAddress, setSelectedPlayerAddress] = useState<string | null>(null);
  const [prevPositions, setPrevPositions] = useState<Map<string, number>>(new Map());

  const isBlitz = getIsBlitz();
  const showTribeDetails = !isBlitz;
  const leaderboardGridTemplate = useMemo(
    () =>
      showTribeDetails
        ? "grid-cols-[68px_minmax(0,_1.25fr)_minmax(0,_1.1fr)_minmax(0,_0.8fr)_minmax(0,_0.8fr)_minmax(0,_0.85fr)_minmax(0,_0.9fr)_minmax(0,_0.95fr)_minmax(0,_1fr)]"
        : "grid-cols-[68px_minmax(0,_1.7fr)_minmax(0,_0.9fr)_minmax(0,_0.9fr)_minmax(0,_0.95fr)_minmax(0,_0.95fr)_minmax(0,_1.05fr)_minmax(0,_1.1fr)]",
    [showTribeDetails],
  );

  useEffect(() => {
    if (!showTribeDetails && activeSort.sortKey === "guild.name") {
      setActiveSort({ sortKey: "leaderboardRank", sort: "asc" });
    }
  }, [showTribeDetails, activeSort.sortKey]);

  useEffect(() => {
    if (!selectedPlayerAddress) {
      return;
    }

    const stillVisible = players.some((player) => String(player.address) === selectedPlayerAddress);

    if (!stillVisible) {
      setSelectedPlayerAddress(null);
    }
  }, [players, selectedPlayerAddress]);

  const playersWithStats = useMemo<PlayerWithStats[]>(() => {
    return players.map((player) => {
      const entry = player.leaderboardEntry ?? null;

      const tilesExplored = entry?.exploredTiles ?? 0;
      const tilesExploredPoints = entry?.exploredTilePoints ?? 0;
      const cratesOpened = entry?.relicCratesOpened ?? 0;
      const cratesOpenedPoints = entry?.relicCratePoints ?? 0;
      const riftsTaken = entry?.riftsTaken ?? entry?.campsTaken ?? 0;
      const riftsTakenPoints = entry?.riftPoints ?? entry?.campPoints ?? 0;
      const hyperstructuresTaken = entry?.hyperstructuresConquered ?? 0;
      const hyperstructuresTakenPoints = entry?.hyperstructurePoints ?? 0;
      const hyperstructuresHeld = player.hyperstructures ?? 0;
      const hyperstructuresHeldPoints = entry?.hyperstructuresHeldPoints ?? 0;

      return {
        ...player,
        leaderboardEntry: entry,
        leaderboardRank: entry?.rank ?? player.rank ?? Number.MAX_SAFE_INTEGER,
        leaderboardPoints: entry?.points ?? player.points ?? 0,
        tilesExplored,
        tilesExploredPoints,
        cratesOpened,
        cratesOpenedPoints,
        riftsTaken,
        riftsTakenPoints,
        hyperstructuresTaken,
        hyperstructuresTakenPoints,
        hyperstructuresHeld,
        hyperstructuresHeldPoints,
      } satisfies PlayerWithStats;
    });
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return playersWithStats.filter(
      (player) => !player.name.includes("Daydreams") && !player.name.includes("Central Bank"),
    );
  }, [playersWithStats]);

  const sortedPlayers = useMemo(() => {
    const playersForSorting = filteredPlayers.map((player) => ({
      ...player,
      rank: player.leaderboardRank,
      points: player.leaderboardPoints,
    }));

    return sortItems(playersForSorting, activeSort, { sortKey: "leaderboardRank", sort: "asc" });
  }, [filteredPlayers, activeSort]);

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
      <PlayerListHeader
        activeSort={activeSort}
        setActiveSort={setActiveSort}
        showTribeDetails={showTribeDetails}
        gridTemplateClass={leaderboardGridTemplate}
      />

      <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent flex-1">
        {sortedPlayers.length > 0 ? (
          sortedPlayers.map((player) => {
            const normalizedAddress = String(player.address);
            const playerEffect = effects.get(normalizedAddress.toLowerCase());

            return (
              <PlayerRow
                key={normalizedAddress}
                player={player}
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
  activeSort,
  setActiveSort,
  showTribeDetails,
  gridTemplateClass,
}: {
  activeSort: SortInterface;
  setActiveSort: (sort: SortInterface) => void;
  showTribeDetails: boolean;
  gridTemplateClass: string;
}) => {
  const sortingParams = useMemo(() => {
    const params: Array<{ label: string; sortKey: string; align: string }> = [
      { label: "Rank", sortKey: "leaderboardRank", align: "justify-center text-center" },
      { label: "Name", sortKey: "name", align: "justify-start text-left" },
    ];

    if (showTribeDetails) {
      params.push({ label: "Tribe", sortKey: "guild.name", align: "justify-start text-left" });
    }

    params.push(
      { label: "Tiles", sortKey: "tilesExplored", align: "justify-center text-center" },
      { label: "Crates", sortKey: "cratesOpened", align: "justify-center text-center" },
      { label: "Rifts/Camps", sortKey: "riftsTaken", align: "justify-center text-center" },
      { label: "HS Taken", sortKey: "hyperstructuresTaken", align: "justify-center text-center" },
      { label: "HS Held", sortKey: "hyperstructuresHeldPoints", align: "justify-center text-center" },
      { label: "Points", sortKey: "leaderboardPoints", align: "justify-center text-center" },
    );

    return params;
  }, [showTribeDetails]);

  return (
    <SortPanel
      className={clsx(
        "grid gap-x-4 items-center pb-3 panel-wood-bottom sticky top-0 z-10 bg-brown/80 backdrop-blur-sm px-4",
        gridTemplateClass,
      )}
    >
      {sortingParams.map(({ label, sortKey, align }) => (
        <SortButton
          key={sortKey}
          label={label}
          sortKey={sortKey}
          activeSort={activeSort}
          className={clsx(
            "w-full gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-amber-200",
            align,
          )}
          classNameCaret="w-2.5 h-2.5"
          activeClassName="text-amber-200"
          inactiveClassName="text-gold/70"
          onChange={(_sortKey, _sort) => {
            setActiveSort({
              sortKey: _sortKey,
              sort: _sort,
            });
          }}
        />
      ))}
    </SortPanel>
  );
};

const PlayerRow = ({
  player,
  onSelect,
  whitelistPlayer,
  isLoading,
  showTribeDetails,
  gridTemplateClass,
  isSelected,
  effect,
  registerRef,
}: {
  player: PlayerWithStats;
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

  const { leaderboardPoints, leaderboardRank, leaderboardEntry } = player;
  const isUnranked = leaderboardRank === Number.MAX_SAFE_INTEGER;
  const tilesLabel = formatActivityValue(player.tilesExplored, player.tilesExploredPoints);
  const cratesLabel = formatActivityValue(player.cratesOpened, player.cratesOpenedPoints);
  const riftsLabel = formatActivityValue(player.riftsTaken, player.riftsTakenPoints);
  const hyperstructuresTakenLabel = formatActivityValue(player.hyperstructuresTaken, player.hyperstructuresTakenPoints);
  const hyperstructuresHeldLabel = formatActivityValue(player.hyperstructuresHeld, player.hyperstructuresHeldPoints);
  const hasShareholderPoints = (leaderboardEntry?.unregisteredPoints ?? 0) > 0;

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
            {isUnranked ? " - " : `#${leaderboardRank}`}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
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
            "text-amber-200": leaderboardPoints > 1000,
            "text-lightest": isSelected && leaderboardPoints <= 1000,
            "text-gold/90": !isSelected && leaderboardPoints <= 1000,
          })}
        >
          <span>{currencyIntlFormat(leaderboardPoints)}</span>
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
