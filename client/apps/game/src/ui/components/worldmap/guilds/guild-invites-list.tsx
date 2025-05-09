import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { SortButton, SortInterface } from "@/ui/elements/sort-button";
import { SortPanel } from "@/ui/elements/sort-panel";
import { sortItems } from "@/ui/utils/utils";
import { ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo, useState } from "react";

interface GuildInviteListProps {
  invitedPlayers: GuildMemberInfo[];
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  removePlayerFromWhitelist: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
}

interface InviteRowProps {
  player: GuildMemberInfo;
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  removePlayerFromWhitelist: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
}

export const GuildInviteList = ({
  invitedPlayers,
  isLoading,
  viewPlayerInfo,
  removePlayerFromWhitelist,
  userIsGuildMaster,
}: GuildInviteListProps) => {
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <div className="flex flex-col p-2 border border-gold/30  h-full bg-brown-900/50 backdrop-blur-sm">
      {/* <GuildInviteListHeader activeSort={activeSort} setActiveSort={setActiveSort} /> */}
      <div className="overflow-y-auto max-h-32 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent gap-2 flex flex-col">
        {sortItems(invitedPlayers, activeSort, { sortKey: "rank", sort: "asc" }).map((player, index) => (
          <InviteRow
            key={index}
            player={player}
            isLoading={isLoading}
            viewPlayerInfo={viewPlayerInfo}
            removePlayerFromWhitelist={removePlayerFromWhitelist}
            userIsGuildMaster={userIsGuildMaster}
          />
        ))}
        {!invitedPlayers.length && <p className="text-center italic text-gold/70 py-4">No Tribe Invites Sent</p>}
      </div>
    </div>
  );
};

interface ListHeaderProps {
  activeSort: SortInterface;
  setActiveSort: (sort: SortInterface) => void;
}

const GuildInviteListHeader = ({ activeSort, setActiveSort }: ListHeaderProps) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "" },
      { label: "Name", sortKey: "name", className: "col-span-2" },
      { label: "Pts", sortKey: "points", className: "" },
    ];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase";

  return (
    <SortPanel className="grid grid-cols-5 p-2 border-b border-gold/20">
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

const InviteRow = ({
  player,
  isLoading,
  viewPlayerInfo,
  removePlayerFromWhitelist,
  userIsGuildMaster,
}: InviteRowProps) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <div className="grid grid-cols-5 w-full hover:bg-gold/10  transition-colors duration-200">
      <div
        className="col-span-4 grid grid-cols-1 cursor-pointer"
        onClick={() => {
          viewPlayerInfo(ContractAddress(player.address!));
        }}
      >
        <p className="truncate font-semibold text-gold/90">{player.name}</p>
      </div>

      {userIsGuildMaster && (
        <Trash
          onClick={() => {
            removePlayerFromWhitelist(player.address!);
            setTooltip(null);
          }}
          className={clsx(
            "m-auto self-center w-5 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all",
            {
              "pointer-events-none": isLoading,
            },
          )}
          onMouseEnter={() =>
            setTooltip({
              content: <div>Revoke tribe invitation</div>,
              position: "top",
            })
          }
          onMouseLeave={() => setTooltip(null)}
        />
      )}
    </div>
  );
};
