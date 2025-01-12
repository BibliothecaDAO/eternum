import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { ContractAddress, GuildMemberInfo } from "@bibliothecadao/eternum";
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

const GuildMemberListHeader = ({
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
      { label: "Points", sortKey: "points", className: "col-span-2 text-center px-1" },
      { label: "Age", sortKey: "age", className: "col-span-1 text-center px-1" },
    ];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase w-full";

  return (
    <SortPanel className="grid grid-cols-6 pb-3 border-b border-gold/20">
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
        "grid grid-cols-6 w-full py-1 cursor-pointer items-center hover:bg-gold/5 rounded-lg transition-colors duration-200 mb-1",
        {
          "bg-blueish/20 hover:bg-blueish/30": guildMember.isUser,
        },
      )}
    >
      <div
        className="col-span-6 grid grid-cols-6 items-center"
        onClick={() => {
          viewPlayerInfo(ContractAddress(guildMember.address));
        }}
      >
        <p className="col-span-1 text-center font-medium italic px-1">
          {guildMember.rank === Number.MAX_SAFE_INTEGER ? `☠️` : `#${guildMember.rank}`}
        </p>
        <p className="col-span-2 flex flex-row items-center truncate font-semibold text-gold/90 px-1">
          {guildMember.isGuildMaster && <Crown className="w-6 fill-gold" />}
          <span className="truncate">{guildMember.name}</span>
        </p>
        <p className="col-span-2 font-medium text-amber-200/90 px-1">{currencyIntlFormat(guildMember.points)}</p>
        <p className="col-span-1 font-medium px-1">{guildMember.age}</p>
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
