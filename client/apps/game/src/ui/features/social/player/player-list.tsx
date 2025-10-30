import { ReactComponent as Invite } from "@/assets/icons/common/envelope.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { SortButton, SortInterface } from "@/ui/design-system/atoms/sort-button";
import { SortPanel } from "@/ui/design-system/molecules/sort-panel";
import { currencyIntlFormat, getRealmCountPerHyperstructure, sortItems } from "@/ui/utils/utils";
import { getIsBlitz, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, GuildInfo, PlayerInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import { User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export interface PlayerCustom extends PlayerInfo {
  structures: string[];
  isUser: boolean;
  isInvited: boolean;
  guild: GuildInfo | undefined;
}

interface PlayerListProps {
  players: PlayerCustom[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
}

export const PlayerList = ({ players, viewPlayerInfo, whitelistPlayer, isLoading }: PlayerListProps) => {
  const {
    setup: { components },
  } = useDojo();

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "rank",
    sort: "asc",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const isBlitz = getIsBlitz();
  const showTribeDetails = !isBlitz;
  const leaderboardGridTemplate = useMemo(
    () =>
      showTribeDetails
        ? "grid-cols-[68px_minmax(0,_1.6fr)_minmax(0,_1.2fr)_minmax(0,_0.8fr)_minmax(0,_0.85fr)_minmax(0,_1.05fr)]"
        : "grid-cols-[68px_minmax(0,_2.4fr)_minmax(0,_0.85fr)_minmax(0,_0.9fr)_minmax(0,_1.3fr)]",
    [showTribeDetails],
  );

  useEffect(() => {
    if (!showTribeDetails && activeSort.sortKey === "guild.name") {
      setActiveSort({ sortKey: "rank", sort: "asc" });
    }
  }, [showTribeDetails, activeSort.sortKey, setActiveSort]);

  // Calculate real-time points for all players including unregistered shareholder points
  const playersWithRealTimePoints = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());

    return players.map((player) => {
      // Get only registered points to avoid double-counting
      const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(ContractAddress(player.address));
      const unregisteredShareholderPoints = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
        ContractAddress(player.address),
      );
      const totalPoints = registeredPoints + unregisteredShareholderPoints;

      return {
        ...player,
        registeredPoints,
        totalPoints,
        unregisteredShareholderPoints,
        hasUnregisteredShareholderPoints: unregisteredShareholderPoints > 0,
      };
    });
  }, [players, components]);

  // Sort players by real-time total points and assign real-time ranks
  const playersWithRealTimeRanks = useMemo(() => {
    // First sort by total points to get real-time rankings
    const sortedByPoints = [...playersWithRealTimePoints].sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign real-time ranks
    return sortedByPoints.map((player, index) => ({
      ...player,
      realTimeRank: player.totalPoints > 0 ? index + 1 : Number.MAX_SAFE_INTEGER,
    }));
  }, [playersWithRealTimePoints]);

  const sortedPlayers = useMemo(() => {
    // First filter out system players
    const filteredPlayers = playersWithRealTimeRanks.filter(
      (player) => !player.name.includes("Daydreams") && !player.name.includes("Central Bank"),
    );

    // Then filter by search query if present
    const normalizedQuery = searchQuery.toLowerCase();
    const searchFiltered = searchQuery
      ? filteredPlayers.filter((player) => {
          const matchesName = player.name.toLowerCase().includes(normalizedQuery);
          const matchesGuild = showTribeDetails ? player.guild?.name?.toLowerCase().includes(normalizedQuery) : false;

          return matchesName || matchesGuild;
        })
      : filteredPlayers;

    // For sorting, map rank to realTimeRank and points to totalPoints
    const playersForSorting = searchFiltered.map((player) => ({
      ...player,
      rank: player.realTimeRank,
      points: player.totalPoints,
    }));

    return sortItems(playersForSorting, activeSort, { sortKey: "rank", sort: "asc" });
  }, [playersWithRealTimeRanks, activeSort, searchQuery, showTribeDetails]);

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
          sortedPlayers.map((player) => (
            <PlayerRow
              key={player.address}
              player={player}
              onClick={() => viewPlayerInfo(ContractAddress(player.address))}
              whitelistPlayer={whitelistPlayer}
              isLoading={isLoading}
              showTribeDetails={showTribeDetails}
              gridTemplateClass={leaderboardGridTemplate}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gold/60">
            <User className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No players found</p>
            {searchQuery && <p className="text-xs mt-1">Try adjusting your search query</p>}
          </div>
        )}
      </div>
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
    const params = [
      { label: "Rank", sortKey: "rank", align: "justify-center text-center" },
      { label: "Name", sortKey: "name", align: "justify-start text-left" },
    ];

    if (showTribeDetails) {
      params.push({ label: "Tribe", sortKey: "guild.name", align: "justify-start text-left" });
    }

    params.push(
      { label: "Realms", sortKey: "realms", align: "justify-center text-center" },
      { label: "Hypers", sortKey: "hyperstructures", align: "justify-center text-center" },
      { label: "Points", sortKey: "points", align: "justify-center text-center" },
    );

    return params;
  }, [showTribeDetails]);

  return (
    <SortPanel
      className={clsx(
        "grid gap-x-4 items-center pb-3 panel-wood-bottom sticky top-0 z-10 bg-brown/80 backdrop-blur-sm px-3",
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
  onClick,
  whitelistPlayer,
  isLoading,
  showTribeDetails,
  gridTemplateClass,
}: {
  player: PlayerCustom & {
    registeredPoints: number;
    totalPoints: number;
    unregisteredShareholderPoints: number;
    hasUnregisteredShareholderPoints: boolean;
    realTimeRank: number;
  };
  onClick: () => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
  showTribeDetails: boolean;
  gridTemplateClass: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  // Use pre-calculated values from parent component
  const { totalPoints, hasUnregisteredShareholderPoints, realTimeRank } = player;

  return (
    <div
      className={clsx("flex w-full transition-colors duration-200 mb-1 rounded-md overflow-hidden group", {
        "bg-gold/30 hover:bg-blueish/40  border border-gold/40": player.isUser,
        "hover:bg-gold/10 border border-transparent hover:border-gold/20": !player.isUser,
      })}
    >
      <div
        className={clsx("grid w-full cursor-pointer items-center gap-x-4 px-3 py-2 text-xs", gridTemplateClass)}
        onClick={onClick}
      >
        <div className="flex justify-center">
          <span
            className={clsx("font-medium", {
              "text-red-400": realTimeRank === Number.MAX_SAFE_INTEGER,
              "italic text-gold/90": realTimeRank !== Number.MAX_SAFE_INTEGER,
            })}
          >
            {realTimeRank === Number.MAX_SAFE_INTEGER ? " - " : `#${realTimeRank}`}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <h6 className="truncate text-sm font-medium text-gold">{player.name}</h6>
        </div>
        {showTribeDetails ? (
          <div
            className={clsx("min-w-0 truncate text-xs", {
              "text-emerald-300/90": player.guild,
              "text-gold/50 italic": !player.guild,
            })}
          >
            {player.guild ? player.guild.name : "No Tribe"}
          </div>
        ) : null}
        <div className="flex justify-center text-sm font-medium text-gold/90">{player.realms || 0}</div>
        <div className="flex justify-center text-sm font-medium text-gold/90">{player.hyperstructures || 0}</div>
        <div
          className={clsx("flex items-center justify-center gap-2 text-sm font-semibold", {
            "text-amber-300": totalPoints > 1000 && !hasUnregisteredShareholderPoints, // Standard amber for high points
            "text-order-brilliance text-shadow-glow-brilliance-xs": hasUnregisteredShareholderPoints, // Bright green 'brilliance' color with glow
            "text-gold/90": totalPoints <= 1000 && !hasUnregisteredShareholderPoints,
          })}
        >
          <span>{currencyIntlFormat(totalPoints)}</span>
          {hasUnregisteredShareholderPoints && (
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
