import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { SortButton, SortInterface } from "@/ui/design-system/atoms/sort-button";
import { SortPanel } from "@/ui/design-system/molecules/sort-panel";
import { sortItems } from "@/ui/utils/utils";
import { ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo, useState } from "react";

interface GuildMemberListProps {
  guildMembers: GuildMemberInfo[];
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
  removeGuildMember: (playerAddress: ContractAddress) => void;
}

interface GuildMemberRowProps {
  guildMember: GuildMemberInfo;
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
  removeGuildMember: (playerAddress: ContractAddress) => void;
}

export const GuildMemberList = ({
  guildMembers,
  isLoading,
  viewPlayerInfo,
  userIsGuildMaster,
  removeGuildMember,
}: GuildMemberListProps) => {
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <div className="flex flex-col rounded-xl h-full">
      {/* <GuildMemberListHeader activeSort={activeSort} setActiveSort={setActiveSort} /> */}
      <div className=" overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
        {sortItems(guildMembers, activeSort, { sortKey: "name", sort: "asc" }).map((guildMember) => (
          <GuildMemberRow
            key={guildMember.address}
            guildMember={guildMember}
            isLoading={isLoading}
            viewPlayerInfo={viewPlayerInfo}
            userIsGuildMaster={userIsGuildMaster}
            removeGuildMember={removeGuildMember}
          />
        ))}
        {!guildMembers.length && <p className="text-center italic text-gold/70 py-4">No Tribe Members</p>}
      </div>
    </div>
  );
};

const GuildMemberListHeader = ({
  activeSort,
  setActiveSort,
}: {
  activeSort: SortInterface;
  setActiveSort: (sort: SortInterface) => void;
}) => {
  const sortingParams = useMemo(() => {
    return [{ label: "Name", sortKey: "name", className: "col-span-2 px-1" }];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase w-full";

  return (
    <SortPanel className="grid grid-cols-2">
      {sortingParams.map(({ label, sortKey, className }) => (
        <SortButton
          key={sortKey}
          label={label}
          sortKey={sortKey}
          activeSort={activeSort}
          className={className + " " + textStyle}
          classNameCaret="w-2"
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

const GuildMemberRow = ({
  guildMember,
  isLoading,
  viewPlayerInfo,
  userIsGuildMaster,
  removeGuildMember,
}: GuildMemberRowProps) => {
  const kickButtonEnabled = userIsGuildMaster && !guildMember.isUser;

  return (
    <div
      className={clsx(
        "grid grid-cols-2 w-full py-1 px-2 cursor-pointer items-center hover:bg-gold/10 rounded transition-colors duration-200 mb-1",
        {
          "bg-blueish/20 hover:bg-blueish/30": guildMember.isUser,
        },
      )}
    >
      <div
        className="col-span-2 grid grid-cols-2 items-center"
        onClick={() => {
          viewPlayerInfo(ContractAddress(guildMember.address));
        }}
      >
        <p className="col-span-2 flex flex-row items-center truncate font-semibold text-gold/90 px-1">
          {guildMember.isGuildMaster && <Crown className="w-6 fill-gold mr-2" />}
          <span className="truncate">{guildMember.name}</span>
        </p>
      </div>

      <div className="flex justify-center">
        {kickButtonEnabled && (
          <Trash
            onClick={() => removeGuildMember(guildMember.address)}
            className={clsx("w-5 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all", {
              "pointer-events-none": isLoading,
            })}
          />
        )}
      </div>
    </div>
  );
};
