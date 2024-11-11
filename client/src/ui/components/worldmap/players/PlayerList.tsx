import { ReactComponent as Invite } from "@/assets/icons/common/envelope.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import useUIStore from "@/hooks/store/useUIStore";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { ContractAddress, GuildInfo } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { ListHeaderProps } from "../guilds/GuildList";

export interface PlayerCustom {
  name: string;
  address: ContractAddress;
  structures: string[];
  isUser: boolean;
  rank: number;
  points: number;
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

  return (
    <div className="flex flex-col p-2 border rounded-xl h-full ">
      <PlayerListHeader activeSort={activeSort} setActiveSort={setActiveSort} />
      <div className="space-y-2 overflow-y-auto">
        {sortItems(players, activeSort, { sortKey: "rank", sort: "asc" }).map((player) => (
          <PlayerRow
            key={player.address}
            player={player}
            onClick={() => {
              viewPlayerInfo(ContractAddress(player.address));
            }}
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

const PlayerListHeader = ({ activeSort, setActiveSort }: ListHeaderProps) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "" },
      { label: "Name", sortKey: "name", className: "col-span-2" },
      { label: "Tribe", sortKey: "guild.name", className: "col-span-2" },
      { label: "Pts", sortKey: "points", className: "" },
      { label: "Structs", sortKey: "structures.length", className: "" },
    ];
  }, []);

  const textStyle = "text-gray-gold font-bold";

  return (
    <SortPanel className="grid grid-cols-8 mb-1 font-bold">
      {sortingParams.map(({ label, sortKey, className }) => (
        <SortButton
          className={className + " " + textStyle}
          classNameCaret="w-2"
          key={sortKey}
          label={label}
          sortKey={sortKey}
          activeSort={activeSort}
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
      className={clsx("flex grid grid-cols-8 rounded", {
        "bg-blueish/20": player.isUser,
      })}
    >
      <div className="col-span-7 grid grid-cols-7 text-md hover:opacity-70 p-1" onClick={onClick}>
        <p className="italic">{player.rank === Number.MAX_SAFE_INTEGER ? `☠️` : `#${player.rank}`}</p>
        <p className="col-span-2 truncate h6">{player.name}</p>
        <p className="col-span-2 truncate h6">{player.guild && `<${player.guild.name}>`}</p>
        <p className="text-center">{currencyIntlFormat(player.points)}</p>
        <p className="text-center">{player.structures.length}</p>
      </div>

      {isGuildMaster &&
        !player.isUser &&
        (player.isInvited ? (
          <Trash
            onClick={() => {
              removePlayerFromWhitelist(player.address);
              setTooltip(null);
            }}
            className={clsx("m-auto self-center w-4 fill-red/70 hover:fill-red/40 duration-100 transition-all", {
              "animate-pulse ": isLoading,
              "pointer-events-none": isLoading,
            })}
            onMouseEnter={() =>
              setTooltip({
                content: <div>Revoke tribe invitation</div>,
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
            className={clsx("m-auto self-center w-4 fill-gold/70 hover:fill-gold/40 duration-100 transition-all", {
              "animate-pulse ": isLoading,
              "pointer-events-none": isLoading,
            })}
            onMouseEnter={() =>
              setTooltip({
                content: <div>Invite to tribe</div>,
                position: "top",
              })
            }
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
    </div>
  );
};
