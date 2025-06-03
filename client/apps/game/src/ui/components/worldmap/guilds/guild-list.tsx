import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SortButton, SortInterface } from "@/ui/elements/sort-button";
import { SortPanel } from "@/ui/elements/sort-panel";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { GuildInfo, ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import { Globe, Lock } from "lucide-react";
import { useMemo, useState } from "react";

export interface GuildCustom extends GuildInfo {
  prize: {
    lords: number;
    strk: number;
  };
  realms: number;
  mines: number;
  hyperstructures: number;
  rank: number;
  points: number;
  isPublic?: boolean;
}

export const GuildListHeader = ({
  activeSort,
  setActiveSort,
}: {
  activeSort: SortInterface;
  setActiveSort: (_sort: SortInterface) => void;
}) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "col-span-1 text-center" },
      { label: "Name", sortKey: "name", className: "col-span-2" },
      { label: "Members", sortKey: "memberCount", className: "col-span-2 text-center" },
      { label: "Structures", sortKey: "structures", className: "col-span-2 text-center" },
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
      {
        label: (
          <div className="flex flex-row w-full gap-1 items-center justify-center">
            STRK
            <ResourceIcon size="md" resource={"Strk"} className="w-5 h-5" />
          </div>
        ),
        sortKey: "strk",
        className: "col-span-1 text-center",
      },
    ];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase w-full";

  return (
    <SortPanel className="grid grid-cols-12 pb-3 border-b panel-wood-bottom sticky top-0  backdrop-blur-sm z-10">
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

export const GuildRow = ({ guild, onClick }: { guild: GuildCustom; onClick: () => void }) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={clsx("flex w-full transition-colors duration-200 mb-1 rounded-md overflow-hidden group", {
        "bg-blueish/20 hover:bg-blueish/30 border border-gold/40": guild.isMember,
        "hover:bg-gold/10 border border-transparent hover:border-gold/20": !guild.isMember,
      })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="grid grid-cols-12 w-full py-2 cursor-pointer items-center" onClick={onClick}>
        <p className="col-span-1 text-center font-medium italic px-1">#{guild.rank}</p>
        <div className="col-span-2 flex items-center px-1">
          {guild.isPublic ? (
            <Globe className="w-4 h-4 text-emerald-300/90 mr-2 flex-shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-300/90 mr-2 flex-shrink-0" />
          )}
          <p className="truncate font-semibold text-gold/90">{guild.name}</p>
        </div>
        <p className="col-span-2 text-center font-medium px-1">{guild.memberCount}</p>
        <p className="col-span-2 text-center font-medium px-1">
          {(guild.realms || 0) + (guild.mines || 0) + (guild.hyperstructures || 0)}
        </p>
        <p className="col-span-2 font-medium text-amber-200/90 px-1 text-center">{currencyIntlFormat(guild.points)}</p>
        <div className="col-span-2 font-medium text-gold/90 px-1 flex items-center gap-1 justify-center">
          {currencyIntlFormat(guild.prize.lords)}
          <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" withTooltip={false} />
        </div>
        <div className="col-span-1 font-medium text-gold/90 px-1 flex items-center gap-1 justify-center">
          {currencyIntlFormat(guild.prize.strk)}
          <ResourceIcon size="md" resource={"Strk"} className="w-4 h-4" withTooltip={false} />
        </div>
      </div>
    </div>
  );
};
