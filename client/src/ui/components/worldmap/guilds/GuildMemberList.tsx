import { ReactComponent as Crown } from "@/assets/icons/Crown.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { ContractAddress, GuildMemberInfo } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { ListHeaderProps } from "./GuildList";

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
    <div className="flex flex-col p-2 border rounded-xl h-full">
      <GuildMemberListHeader activeSort={activeSort} setActiveSort={setActiveSort} />
      <div className="space-y-2 overflow-y-auto">
        {sortItems(guildMembers, activeSort, { sortKey: "rank", sort: "asc" }).map((guildMember) => (
          <GuildMemberRow
            key={guildMember.address}
            guildMember={guildMember}
            isLoading={isLoading}
            viewPlayerInfo={viewPlayerInfo}
            userIsGuildMaster={userIsGuildMaster}
            removeGuildMember={removeGuildMember}
          />
        ))}
      </div>
    </div>
  );
};

const GuildMemberListHeader = ({ activeSort, setActiveSort }: ListHeaderProps) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "" },
      { label: "Name", sortKey: "name", className: "col-span-2" },
      { label: "Pts", sortKey: "points", className: "" },
      { label: "Age", sortKey: "age", className: "" },
    ];
  }, []);

  const textStyle = "text-gray-gold font-bold";

  return (
    <SortPanel className="grid grid-cols-6 mb-1 font-bold">
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
      className={clsx("flex grid grid-cols-6 rounded", {
        "bg-blueish/20": guildMember.isUser,
      })}
    >
      <div
        className="col-span-5 grid grid-cols-5 gap-1 text-md hover:opacity-70 p-1"
        onClick={() => {
          viewPlayerInfo(ContractAddress(guildMember.address));
        }}
      >
        <p className="italic">{guildMember.rank === Number.MAX_SAFE_INTEGER ? `☠️` : `#${guildMember.rank}`}</p>
        <p className="col-span-2 flex flex-row">
          <span>{guildMember.isGuildMaster && <Crown className="w-6 fill-gold" />}</span>
          <span className="truncate font-bold h6">{guildMember.name}</span>
        </p>
        <p className="text-center">{currencyIntlFormat(guildMember.points)}</p>
        <p className="text-center text-sm">{guildMember.age}</p>
      </div>

      {kickButtonEnabled && (
        <Trash
          onClick={() => removeGuildMember(guildMember.address)}
          className={clsx(
            "m-auto self-center w-5 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all",
            {
              "pointer-events-none": isLoading,
            },
          )}
        />
      )}
    </div>
  );
};
