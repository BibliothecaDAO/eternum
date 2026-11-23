import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import type { SortInterface } from "@/ui/utils/utils";
import { HudButton, HudChip, HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
import { GuildInfo } from "@bibliothecadao/types";
import clsx from "clsx";

import { useMemo } from "react";

interface GuildCustom extends GuildInfo {
  realms: number;
  mines: number;
  hyperstructures: number;
  structureCount: number;
  isPublic?: boolean;
}

const GUILD_COLS = "minmax(0, 1.3fr) minmax(0, 0.85fr) minmax(0, 0.95fr)";

export const GuildListHeader = ({
  activeSort,
  setActiveSort,
}: {
  activeSort: SortInterface;
  setActiveSort: (_sort: SortInterface) => void;
}) => {
  const sortingParams = useMemo<Array<{ label: string; sortKey: string; align: string }>>(
    () => [
      { label: "Name", sortKey: "name", align: "justify-start text-left" },
      { label: "Members", sortKey: "memberCount", align: "justify-center text-center" },
      { label: "Structures", sortKey: "structureCount", align: "justify-center text-center" },
    ],
    [],
  );

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
  label: string;
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
    </HudTableRow>
  </div>
);
