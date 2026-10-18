import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import type { SortInterface } from "@/ui/utils/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { HudButton, HudChip, HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
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

/** Rank, name, members, structures, points and the two prizes. */
const GUILD_COLS =
  "68px minmax(0, 1.3fr) minmax(0, 0.85fr) minmax(0, 0.95fr) minmax(0, 0.95fr) minmax(0, 1fr) minmax(0, 0.85fr)";

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
    <HudTableHead cols={GUILD_COLS}>
      {sortingParams.map(({ label, sortKey, align }) => (
        <span key={sortKey} className={clsx("flex", align)}>
          <SortHeader label={label} sortKey={sortKey} activeSort={activeSort} onChange={setActiveSort} />
        </span>
      ))}
    </HudTableHead>
  );
};

/** The way a column sorts after a press: up, then down, then the list's own order. */
const NEXT_SORT = { none: "asc", asc: "desc", desc: "none" } as const;

/** A column's name as a quiet button that sorts the table on it; a chevron says which way it sorts now. */
const SortHeader = ({
  label,
  sortKey,
  activeSort,
  onChange,
}: {
  label: string | ReactElement;
  sortKey: string;
  activeSort: SortInterface;
  onChange: (sort: SortInterface) => void;
}) => {
  const sort = activeSort.sortKey === sortKey ? activeSort.sort : "none";
  return (
    <HudButton
      kind="quiet"
      size="sm"
      icon={sort === "asc" ? "chevron-up" : sort === "desc" ? "chevron-down" : undefined}
      aria-pressed={sort !== "none"}
      onClick={() => onChange({ sortKey, sort: NEXT_SORT[sort] })}
    >
      {label}
    </HudButton>
  );
};

export const GuildRow = ({ guild, onClick }: { guild: GuildCustom; onClick: () => void }) => (
  // The player's own tribe is lit, as their own row is on the players' table.
  <div className={clsx("mb-1 rounded-md", guild.isMember && "bg-hud-hover")}>
    <HudTableRow cols={GUILD_COLS} label={`${guild.name}: its members`} onClick={onClick}>
      <span className="text-center text-hud-muted">{guild.rank === null ? "—" : `#${guild.rank}`}</span>
      <div className="flex min-w-0 items-center gap-2">
        {guild.isPublic ? (
          <SemanticIcon name="map" className="h-4 w-4 shrink-0 text-hud-good" />
        ) : (
          <SemanticIcon name="lock" className="h-4 w-4 shrink-0 text-hud-warn" />
        )}
        <span className="truncate text-hud-strong">{guild.name}</span>
        {guild.isMember && <HudChip tone="warn">Your Tribe</HudChip>}
      </div>
      <span className="text-center">{guild.memberCount}</span>
      <span className="text-center">{(guild.realms || 0) + (guild.mines || 0) + (guild.hyperstructures || 0)}</span>
      <span className="text-center text-hud-strong text-hud-gold">
        {guild.points === null ? "—" : currencyIntlFormat(guild.points)}
      </span>
      <span className="flex items-center justify-center gap-1">
        {guild.prize === null ? "—" : currencyIntlFormat(guild.prize.lords)}
        <ResourceIcon size="md" resource={ResourcesIds.Lords} className="h-4 w-4" withTooltip={false} />
      </span>
      <span className="flex items-center justify-center gap-1">
        {guild.prize === null ? "—" : currencyIntlFormat(guild.prize.strk)}
        <SemanticIcon name="strk" size={16} className="h-4 w-4" />
      </span>
    </HudTableRow>
  </div>
);
