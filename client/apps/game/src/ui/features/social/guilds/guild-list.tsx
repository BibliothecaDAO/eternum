import { SortButton, SortInterface } from "@/ui/design-system/atoms/sort-button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SortPanel } from "@/ui/design-system/molecules/sort-panel";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { GuildInfo, ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import Globe from "lucide-react/dist/esm/icons/globe";
import Lock from "lucide-react/dist/esm/icons/lock";
import { ReactElement, useMemo } from "react";

interface GuildCustom extends GuildInfo {
  prize: {
    lords: number;
    strk: number;
  };
  realms: number;
  mines: number;
  hyperstructures: number;
  structureCount: number;
  rank: number;
  points: number;
  isPublic?: boolean;
}

const GUILD_GRID_TEMPLATE =
  "grid-cols-[68px_minmax(0,_1.3fr)_minmax(0,_0.85fr)_minmax(0,_0.95fr)_minmax(0,_0.95fr)_minmax(0,_1fr)_minmax(0,_0.85fr)]";

export const GuildListHeader = ({
  activeSort,
  setActiveSort,
}: {
  activeSort: SortInterface;
  setActiveSort: (_sort: SortInterface) => void;
}) => {
  const sortingParams = useMemo<Array<{ label: string | ReactElement; sortKey: string; align: string }>>(() => {
    return [
      { label: "Rank", sortKey: "rank", align: "justify-center text-center" },
      { label: "Name", sortKey: "name", align: "justify-start text-left" },
      { label: "Members", sortKey: "memberCount", align: "justify-center text-center" },
      { label: "Structures", sortKey: "structureCount", align: "justify-center text-center" },
      { label: "Points", sortKey: "points", align: "justify-center text-center" },
      {
        label: (
          <div className="flex w-full items-center justify-center gap-1">
            LORDS
            <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="h-4 w-4" />
          </div>
        ),
        sortKey: "prize.lords",
        align: "justify-center text-center",
      },
      {
        label: (
          <div className="flex w-full items-center justify-center gap-1">
            STRK
            <ResourceIcon size="md" resource={"Strk"} className="h-4 w-4" />
          </div>
        ),
        sortKey: "prize.strk",
        align: "justify-center text-center",
      },
    ];
  }, []);

  return (
    <SortPanel
      className={clsx(
        "grid gap-x-4 items-center pb-3 panel-wood-bottom sticky top-0 z-10 bg-brown/80 backdrop-blur-sm px-4",
        GUILD_GRID_TEMPLATE,
      )}
    >
      {sortingParams.map(({ label, sortKey, align }) => (
        <SortButton
          key={sortKey}
          label={label}
          sortKey={sortKey}
          activeSort={activeSort}
          className={clsx(
            "w-full gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-amber-200",
            align,
          )}
          classNameCaret="w-2.5 h-2.5"
          activeClassName="text-amber-200"
          inactiveClassName="text-gold/70"
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
  return (
    <div
      className={clsx("flex w-full transition-colors duration-200 mb-1 rounded-md overflow-hidden group", {
        "border border-gold/40 bg-gold/15 hover:bg-gold/20": guild.isMember,
        "border border-transparent bg-dark/40 hover:border-gold/20 hover:bg-brown/40": !guild.isMember,
      })}
    >
      <div
        className={clsx("grid w-full cursor-pointer items-center gap-x-4 px-4 py-2 text-xs", GUILD_GRID_TEMPLATE)}
        onClick={onClick}
      >
        <p className="text-center font-medium italic text-gold/90">#{guild.rank}</p>
        <div className="flex min-w-0 items-center gap-2">
          {guild.isPublic ? (
            <Globe className="h-4 w-4 shrink-0 text-emerald-300/90" />
          ) : (
            <Lock className="h-4 w-4 shrink-0 text-amber-300/90" />
          )}
          <p className="truncate text-sm font-semibold text-gold">{guild.name}</p>
          {guild.isMember && (
            <span className="shrink-0 rounded-full border border-amber-200/50 bg-amber-200/20 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-amber-200">
              Your Tribe
            </span>
          )}
        </div>
        <p className="text-center text-sm font-medium text-gold/90">{guild.memberCount}</p>
        <p className="text-center text-sm font-medium text-gold/90">
          {(guild.realms || 0) + (guild.mines || 0) + (guild.hyperstructures || 0)}
        </p>
        <p className="text-center text-sm font-semibold text-amber-200/90">{currencyIntlFormat(guild.points)}</p>
        <div className="flex items-center justify-center gap-1 text-sm font-medium text-gold/90">
          {currencyIntlFormat(guild.prize.lords)}
          <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="h-4 w-4" withTooltip={false} />
        </div>
        <div className="flex items-center justify-center gap-1 text-sm font-medium text-gold/90">
          {currencyIntlFormat(guild.prize.strk)}
          <ResourceIcon size="md" resource={"Strk"} className="h-4 w-4" withTooltip={false} />
        </div>
      </div>
    </div>
  );
};
