import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SortButton, SortInterface } from "@/ui/elements/sort-button";
import { SortPanel } from "@/ui/elements/sort-panel";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { GuildInfo, ResourcesIds } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { LockOpen } from "lucide-react";
import { useMemo } from "react";

export const GuildListHeader = ({
  activeSort,
  setActiveSort,
}: {
  activeSort: SortInterface;
  setActiveSort: (_sort: SortInterface) => void;
}) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "col-span-1 text-center px-1" },
      { label: "Name", sortKey: "name", className: "col-span-2 px-1" },
      { label: "Realms", sortKey: "realms", className: "col-span-1 text-center px-1" },
      { label: "Mines", sortKey: "mines", className: "col-span-1 text-center px-1" },
      { label: "Hypers", sortKey: "hyperstructures", className: "col-span-1 text-center px-1" },
      { label: "Members", sortKey: "memberCount", className: "col-span-1 text-center px-1" },
      { label: "Points", sortKey: "points", className: "col-span-2 text-center px-1" },
      {
        label: (
          <div className="flex flex-row w-full gap-1 items-center justify-center">
            LORDS
            <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
          </div>
        ),
        sortKey: "lords",
        className: "col-span-2 text-center px-1",
      },
      { label: "Status", sortKey: "isPublic", className: "col-span-1 text-center px-1" },
    ];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase w-full";

  return (
    <SortPanel className="grid grid-cols-12 w-full p-2 border-b border-gold/20">
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

export const GuildRow = ({
  guild,
  onClick,
}: {
  guild: GuildInfo & {
    lords: number;
    realms: number;
    mines: number;
    hyperstructures: number;
    rank: number;
    points: number;
  };
  onClick: () => void;
}) => {
  return (
    <div
      className={clsx(
        "grid grid-cols-12 w-full py-2 px-2 cursor-pointer items-center hover:bg-gold/10 rounded-lg transition-colors duration-200 mb-1",
        {
          "bg-blueish/20 hover:bg-blueish/30": guild.isMember,
        },
      )}
      onClick={onClick}
    >
      <p className="col-span-1 text-center font-medium italic px-1">#{guild.rank}</p>
      <p className="col-span-2 truncate font-semibold text-gold/90 px-1">{guild.name}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.realms}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.mines}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.hyperstructures}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.memberCount}</p>
      <p className="col-span-2 font-medium text-amber-200/90 px-1 text-center">{currencyIntlFormat(guild.points)}</p>
      <div className="col-span-2 font-medium text-gold/90 px-1 flex items-center gap-1 justify-center">
        {currencyIntlFormat(guild.lords)}
        <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
      </div>
      <div className="col-span-1 flex justify-center">
        {guild.isPublic ? <LockOpen className="w-4 h-4 text-gold" /> : <LockOpen className="w-4 h-4 text-gold/50" />}
      </div>
    </div>
  );
};
