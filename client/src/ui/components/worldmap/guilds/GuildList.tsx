import { ReactComponent as LockClosed } from "@/assets/icons/common/lock-closed.svg";
import { ReactComponent as LockOpen } from "@/assets/icons/common/lock-open.svg";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { GuildInfo, ID } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo, useState } from "react";

interface GuildListProps {
  guilds: GuildInfo[];
  viewGuildInvites: boolean;
  viewGuildMembers: (guildEntityId: ID) => void;
}

export interface ListHeaderProps {
  activeSort: SortInterface;
  setActiveSort: (activeSort: SortInterface) => void;
}

interface GuildRowProps {
  guild: GuildInfo;
  onClick: () => void;
}

export const GuildList = ({ guilds, viewGuildInvites, viewGuildMembers }: GuildListProps) => {
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <div className="flex flex-col p-2 border rounded-xl h-full">
      <GuildListHeader activeSort={activeSort} setActiveSort={setActiveSort} />
      <div className="flex flex-col space-y-2 overflow-y-auto flex-1">
        {sortItems(guilds, activeSort, { sortKey: "rank", sort: "asc" }).map((guild) => (
          <GuildRow key={guild.entityId} guild={guild} onClick={() => viewGuildMembers(guild.entityId)} />
        ))}
        {!guilds.length && viewGuildInvites && <p className="text-center italic">No Tribe Invites Received</p>}
      </div>
    </div>
  );
};

const GuildListHeader = ({ activeSort, setActiveSort }: ListHeaderProps) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "" },
      { label: "Name", sortKey: "name", className: "col-span-2" },
      { label: "Pts", sortKey: "points", className: "" },
      { label: "Memb.", sortKey: "memberCount", className: "" },
      { label: "Age", sortKey: "age", className: "" },
    ];
  }, []);

  const textStyle = "text-gray-gold font-bold";

  return (
    <SortPanel className="grid grid-cols-7 mb-1 font-bold">
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

const GuildRow = ({ guild, onClick }: GuildRowProps) => {
  return (
    <div
      className={clsx("flex grid grid-cols-7 text-md hover:opacity-70  rounded", {
        "bg-blueish/20": guild.isMember,
      })}
      onClick={onClick}
    >
      <p className="italic">#{guild.rank}</p>
      <p className="col-span-2 truncate font-bold h6">{guild.name}</p>
      <p className="text-center">{currencyIntlFormat(guild.points!)}</p>
      <p className="text-center">{guild.memberCount}</p>
      <p className="text-center text-sm">{guild.age}</p>
      <div className="flex justify-end mr-1">
        {guild.isPublic ? <LockOpen className="fill-gold w-4" /> : <LockClosed className="fill-gold/50 w-4" />}
      </div>
    </div>
  );
};
