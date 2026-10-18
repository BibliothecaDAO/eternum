import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { SortButton, SortInterface } from "@/ui/design-system/atoms/sort-button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SortPanel } from "@/ui/design-system/molecules/sort-panel";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { GuildInfo, ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";

import { ReactElement, useMemo } from "react";

interface GuildCustom extends GuildInfo {
  prize: {
    lords: number;
    strk: number;
  } | null;
  realms: number;
  mines: number;
  hyperstructures: number;
  structureCount: number;
  rank: number | null;
  points: number | null;
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
            <ResourceIcon size="md" resource={ResourcesIds.Lords} className="h-4 w-4" />
          </div>
        ),
        sortKey: "prize.lords",
        align: "justify-center text-center",
      },
      {
        label: (
          <div className="flex w-full items-center justify-center gap-1">
            STRK
            <SemanticIcon name="strk" size={16} className="h-4 w-4" />
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
        "grid gap-x-4 items-center pb-3 border-b border-hud-line sticky top-0 z-10 bg-hud-well backdrop-blur-sm px-4",
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
            "w-full gap-2 text-hud-label uppercase tracking-[0.16em] transition-colors hover:text-hud-warn",
            align,
          )}
          classNameCaret="w-2.5 h-2.5"
          activeClassName="text-hud-warn"
          inactiveClassName="text-hud-muted"
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
        "border border-hud-line-strong bg-hud-chosen hover:bg-hud-chosen": guild.isMember,
        "border border-transparent bg-hud-well hover:border-hud-line hover:bg-hud-well": !guild.isMember,
      })}
    >
      <div
        className={clsx(
          "grid w-full cursor-pointer items-center gap-x-4 px-4 py-2 text-hud-label",
          GUILD_GRID_TEMPLATE,
        )}
        onClick={onClick}
      >
        <p className="text-center italic text-hud-accent">{guild.rank === null ? "—" : `#${guild.rank}`}</p>
        <div className="flex min-w-0 items-center gap-2">
          {guild.isPublic ? (
            <SemanticIcon name="map" className="h-4 w-4 shrink-0 text-hud-good" />
          ) : (
            <SemanticIcon name="lock" className="h-4 w-4 shrink-0 text-hud-warn" />
          )}
          <p className="truncate text-hud-strong text-hud-accent">{guild.name}</p>
          {guild.isMember && (
            <span className="shrink-0 rounded-full border border-hud-warn bg-amber-200/20 px-2 py-0.5 text-hud-label uppercase tracking-[0.16em] text-hud-warn">
              Your Tribe
            </span>
          )}
        </div>
        <p className="text-center text-hud-body text-hud-accent">{guild.memberCount}</p>
        <p className="text-center text-hud-body text-hud-accent">
          {(guild.realms || 0) + (guild.mines || 0) + (guild.hyperstructures || 0)}
        </p>
        <p className="text-center text-hud-strong text-hud-warn">
          {guild.points === null ? "—" : currencyIntlFormat(guild.points)}
        </p>
        <div className="flex items-center justify-center gap-1 text-hud-body text-hud-accent">
          {guild.prize === null ? "—" : currencyIntlFormat(guild.prize.lords)}
          <ResourceIcon size="md" resource={ResourcesIds.Lords} className="h-4 w-4" withTooltip={false} />
        </div>
        <div className="flex items-center justify-center gap-1 text-hud-body text-hud-accent">
          {guild.prize === null ? "—" : currencyIntlFormat(guild.prize.strk)}
          <SemanticIcon name="strk" size={16} className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};
