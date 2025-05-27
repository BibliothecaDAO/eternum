import { ReactComponent as Invite } from "@/assets/icons/common/envelope.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SortButton, SortInterface } from "@/ui/elements/sort-button";
import { SortPanel } from "@/ui/elements/sort-panel";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, GuildInfo, PlayerInfo, ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import { User } from "lucide-react";
import { useMemo, useState } from "react";

export interface PlayerCustom extends PlayerInfo {
  structures: string[];
  isUser: boolean;
  isInvited: boolean;
  guild: GuildInfo | undefined;
}

interface PlayerListProps {
  players: PlayerCustom[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  isGuildMaster: boolean;
  whitelistPlayer: (address: ContractAddress) => void;
  removePlayerFromWhitelist: (address: ContractAddress) => void;
  isLoading: boolean;
}

export const PlayerList = ({
  players,
  viewPlayerInfo,
  isGuildMaster,
  whitelistPlayer,
  removePlayerFromWhitelist,
  isLoading,
}: PlayerListProps) => {
  const {
    setup: { components },
  } = useDojo();

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "rank",
    sort: "asc",
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate real-time points for all players including unregistered shareholder points
  const playersWithRealTimePoints = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(components);

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
    const searchFiltered = searchQuery
      ? filteredPlayers.filter(
          (player) =>
            player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            player.guild?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : filteredPlayers;

    // For sorting, map rank to realTimeRank and points to totalPoints
    const playersForSorting = searchFiltered.map((player) => ({
      ...player,
      rank: player.realTimeRank,
      points: player.totalPoints,
    }));

    return sortItems(playersForSorting, activeSort, { sortKey: "rank", sort: "asc" });
  }, [playersWithRealTimeRanks, activeSort, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <PlayerListHeader activeSort={activeSort} setActiveSort={setActiveSort} />

      <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent flex-1">
        {sortedPlayers.length > 0 ? (
          sortedPlayers.map((player) => (
            <PlayerRow
              key={player.address}
              player={player}
              onClick={() => viewPlayerInfo(ContractAddress(player.address))}
              isGuildMaster={isGuildMaster}
              whitelistPlayer={whitelistPlayer}
              removePlayerFromWhitelist={removePlayerFromWhitelist}
              isLoading={isLoading}
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
}: {
  activeSort: SortInterface;
  setActiveSort: (sort: SortInterface) => void;
}) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "col-span-1 text-center" },
      { label: "Name", sortKey: "name", className: "col-span-2" },
      { label: "Tribe", sortKey: "guild.name", className: "col-span-2" },
      { label: "Structures", sortKey: "structures", className: "col-span-3 text-center" },
      { label: "Points", sortKey: "points", className: "col-span-2 text-center" },
      {
        label: (
          <div className="flex flex-row w-full gap-1 items-center justify-center">
            LORDS
            <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
          </div>
        ),
        sortKey: "lords",
        className: "col-span-2 text-center",
      },
    ];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase w-full";

  return (
    <SortPanel className="grid grid-cols-12 pb-3 border-b panel-wood-bottom sticky top-0 z-10">
      {sortingParams.map(({ label, sortKey, className }) => (
        <SortButton
          key={sortKey}
          label={label}
          sortKey={sortKey}
          activeSort={activeSort}
          className={`${className} ${textStyle}`}
          classNameCaret="w-2.5 h-2.5 ml-1"
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
  isGuildMaster,
  whitelistPlayer,
  removePlayerFromWhitelist,
  isLoading,
}: {
  player: PlayerCustom & {
    registeredPoints: number;
    totalPoints: number;
    unregisteredShareholderPoints: number;
    hasUnregisteredShareholderPoints: boolean;
    realTimeRank: number;
  };
  onClick: () => void;
  isGuildMaster: boolean;
  whitelistPlayer: (address: ContractAddress) => void;
  removePlayerFromWhitelist: (address: ContractAddress) => void;
  isLoading: boolean;
}) => {
  const {
    setup: { components },
  } = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [isHovered, setIsHovered] = useState(false);

  // Use pre-calculated values from parent component
  const { totalPoints, hasUnregisteredShareholderPoints, realTimeRank } = player;

  return (
    <div
      className={clsx("flex w-full transition-colors duration-200 mb-1 rounded-md overflow-hidden group", {
        "bg-gold/30 hover:bg-blueish/40  border border-gold/40": player.isUser,
        "hover:bg-gold/10 border border-transparent hover:border-gold/20": !player.isUser,
      })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="grid grid-cols-12 w-full py-2 cursor-pointer items-center" onClick={onClick}>
        <p
          className={clsx("col-span-1 text-center font-medium", {
            "text-red-400": realTimeRank === Number.MAX_SAFE_INTEGER,
            italic: realTimeRank !== Number.MAX_SAFE_INTEGER,
          })}
        >
          {realTimeRank === Number.MAX_SAFE_INTEGER ? " - " : `#${realTimeRank}`}
        </p>
        <div className="col-span-2 flex items-center gap-1">
          <h6 className="truncate text-xs">{player.name}</h6>
        </div>
        <p
          className={clsx("col-span-2 truncate", {
            "text-emerald-300/90": player.guild,
            "text-gold/50 italic text-xs": !player.guild,
          })}
        >
          {player.guild ? player.guild.name : "No Tribe"}
        </p>
        <p className="col-span-3 text-center font-medium">
          {(player.banks || 0) +
            (player.realms || 0) +
            (player.mines || 0) +
            (player.hyperstructures || 0) +
            (player.villages || 0)}
        </p>
        <div
          className={clsx("col-span-2 text-center font-medium flex items-center justify-center gap-1", {
            "text-amber-300": totalPoints > 1000 && !hasUnregisteredShareholderPoints, // Standard amber for high points
            "text-order-brilliance font-bold text-shadow-glow-brilliance-xs": hasUnregisteredShareholderPoints, // Bright green 'brilliance' color with glow
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
        <div className="col-span-2 text-center font-medium flex items-center justify-center gap-1">
          {currencyIntlFormat(player.lords)}
          <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" withTooltip={false} />
        </div>
      </div>

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
        {/* {isGuildMaster && !player.isUser ? (
          player.isInvited ? (
            <Trash
              onClick={() => {
                removePlayerFromWhitelist(player.address);
                setTooltip(null);
              }}
              className={clsx("w-5 h-5 fill-red-400/90 hover:fill-red-500/90 transition-all duration-200", {
                "animate-pulse opacity-50 pointer-events-none": isLoading,
                "cursor-pointer": !isLoading,
              })}
              onMouseEnter={() =>
                setTooltip({
                  content: <div className="text-red-400">Revoke tribe invitation</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          ) : (
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
          )
        ) : (
          isHovered &&
          !player.isUser && (
            <MessageCircle
              className="w-4 h-4 text-gold/70 hover:text-gold cursor-pointer transition-colors"
              onMouseEnter={() =>
                setTooltip({
                  content: <div className="text-gold">Message player</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          )
        )} */}
      </div>
    </div>
  );
};
