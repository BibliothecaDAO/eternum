import { ReactComponent as Invite } from "@/assets/icons/common/envelope.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SortButton, SortInterface } from "@/ui/elements/sort-button";
import { SortPanel } from "@/ui/elements/sort-panel";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { ContractAddress, GuildInfo, Player, ResourcesIds } from "@bibliothecadao/eternum";
import { useUIStore } from "@bibliothecadao/react";
import clsx from "clsx";
import { useMemo, useState } from "react";

export interface PlayerCustom extends Player {
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
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const sortedPlayers = useMemo(
    () => sortItems(players, activeSort, { sortKey: "rank", sort: "asc" }),
    [players, activeSort],
  );

  return (
    <div className="flex flex-col h-full p-2 bg-brown-900/50 border border-gold/30 rounded-xl backdrop-blur-sm">
      <PlayerListHeader activeSort={activeSort} setActiveSort={setActiveSort} />
      <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
        {sortedPlayers.map((player) => (
          <PlayerRow
            key={player.address}
            player={player}
            onClick={() => viewPlayerInfo(ContractAddress(player.address))}
            isGuildMaster={isGuildMaster}
            whitelistPlayer={whitelistPlayer}
            removePlayerFromWhitelist={removePlayerFromWhitelist}
            isLoading={isLoading}
          />
        ))}
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
      { label: "Rank", sortKey: "rank", className: "col-span-1 text-center px-1" },
      { label: "Name", sortKey: "name", className: "col-span-2 px-1" },
      { label: "Tribe", sortKey: "guild.name", className: "col-span-2 px-1" },
      { label: "Realms", sortKey: "realms", className: "col-span-1 text-center px-1" },
      { label: "Mines", sortKey: "mines", className: "col-span-1 text-center px-1" },
      { label: "Hypers", sortKey: "hyperstructures", className: "col-span-1 text-center px-1" },
      { label: "Points", sortKey: "points", className: "col-span-2 text-center px-1" },
      {
        label: (
          <div className="flex flex-row w-full gap-1 items-center">
            LORDS
            <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
          </div>
        ),
        sortKey: "lords",
        className: "col-span-2 text-center px-1",
      },
    ];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase w-full";

  return (
    <SortPanel className="grid grid-cols-12 pb-3 border-b border-gold/20">
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

interface PlayerRowProps {
  player: PlayerCustom;
  onClick: () => void;
  isGuildMaster: boolean;
  whitelistPlayer: (address: ContractAddress) => void;
  removePlayerFromWhitelist: (address: ContractAddress) => void;
  isLoading: boolean;
}

const PlayerRow = ({
  player,
  onClick,
  isGuildMaster,
  whitelistPlayer,
  removePlayerFromWhitelist,
  isLoading,
}: PlayerRowProps) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <div
      className={clsx("flex w-full rounded-lg transition-colors duration-200 mb-1", {
        "bg-blueish/20 hover:bg-blueish/30": player.isUser,
        "hover:bg-gold/5": !player.isUser,
      })}
    >
      <div className="grid grid-cols-12 w-full py-1 cursor-pointer items-center" onClick={onClick}>
        <p className="col-span-1 text-center font-medium italic px-1">
          {player.rank === Number.MAX_SAFE_INTEGER ? "☠️" : `#${player.rank}`}
        </p>
        <p className="col-span-2 truncate font-semibold text-gold/90 px-1">{player.name}</p>
        <p className="col-span-2 truncate text-emerald-300/90 px-1">{player.guild && `${player.guild.name}`}</p>
        <p className="col-span-1 text-center font-medium px-1">{player.realms}</p>
        <p className="col-span-1 text-center font-medium px-1">{player.mines}</p>
        <p className="col-span-1 text-center font-medium px-1">{player.hyperstructures}</p>
        <p className="col-span-2 font-medium text-amber-200/90 px-1">{currencyIntlFormat(player.points)}</p>
        <div className="col-span-2 font-medium text-gold/90 px-1 flex items-center gap-1">
          {currencyIntlFormat(player.lords)}
          <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
        </div>
      </div>

      {isGuildMaster &&
        !player.isUser &&
        (player.isInvited ? (
          <Trash
            onClick={() => {
              removePlayerFromWhitelist(player.address);
              setTooltip(null);
            }}
            className={clsx("w-5 h-5 m-auto fill-red-400/90 hover:fill-red-500/90 transition-all duration-200", {
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
            className={clsx("w-5 h-5 m-auto fill-gold hover:fill-amber-400 transition-all duration-200", {
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
        ))}
    </div>
  );
};
