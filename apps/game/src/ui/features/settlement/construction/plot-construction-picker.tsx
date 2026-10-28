import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { BuildingThumbnail } from "./building-thumbnail";
import { BuildingHover } from "./building-hover";
import {
  BuildingType,
  formatCharge,
  getProducedResource,
  resourceName,
  ResourcesIds,
  type TroopType,
} from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudButton, HudRow, HudSwitch, HudTabs, HudTierChip } from "@/ui/design-system/kit/hud-elements";
import { BUILD } from "@/ui/design-system/kit/words";
import type { ConstructionGrid } from "./construction-groups";
import type { MilitaryBuildingGroup } from "./realm-building-summary";
import { usePlotConstruction, type PlotConstructionTarget } from "./use-plot-construction";
import { ActionFailureNotice } from "@/ui/features/event-feed/action-failure-notice";

type Form = ReturnType<typeof usePlotConstruction>;
type Choice = Form["groups"][number]["buildings"][number];

/** Each troop type's column head: the troop its buildings train, by its name without a tier, and its painting. */
const TROOP_HEADS: Record<MilitaryBuildingGroup, { name: TroopType; painting: ResourcesIds }> = {
  Stable: { name: "Paladin", painting: ResourcesIds.Paladin },
  Barracks: { name: "Knight", painting: ResourcesIds.Knight },
  Archery: { name: "Crossbowman", painting: ResourcesIds.Crossbowman },
};

/**
 * Blitz's "Build on this plot" panel (the owner's pick, option C · List and detail): a tab a group; resources and
 * military in their fixed grids (a resource line or a troop type a column, a tier a row, never re-sorted: a building
 * the realm cannot raise stays in its place, locked), the rest a row a building with what it gives and its cost; then
 * the chosen building whole, as its hover writes it, with Build or the reason it cannot rise.
 */
export function PlotConstructionPicker(target: PlotConstructionTarget) {
  const form = usePlotConstruction(target);
  const [tab, setTab] = useState(form.groups[0]?.label);
  const [chosen, setChosen] = useState<BuildingType | null>(null);
  useEffect(() => {
    if (!form.visible) usePopoverStore.getState().close("plot-construction");
  }, [form.visible]);
  if (!form.visible) return null;
  const group = form.groups.find((each) => each.label === tab) ?? form.groups[0];
  // The chosen building of the open tab; a tab opens on its first, the top left of its grid where it has one.
  const first = group?.grid?.rows.flat().find((type) => type !== null) ?? group?.buildings[0]?.type;
  const choice =
    group?.buildings.find((building) => building.type === chosen) ??
    group?.buildings.find((building) => building.type === first);
  return (
    <div className="ui flex w-96 max-w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-hud-title">Build on this plot</span>
        {form.allowSimpleCost && (
          <span className="flex items-center gap-2 text-hud-label">
            Simple cost
            <HudSwitch on={form.useSimpleCost} label="Simple cost" onChange={form.setUseSimpleCost} />
          </span>
        )}
      </div>
      {form.groups.length > 1 && group && (
        <HudTabs
          size="sm"
          tabs={form.groups.map((each) => ({ key: each.label, label: each.label }))}
          value={group.label}
          onChange={setTab}
        />
      )}
      {form.error && <ActionFailureNotice failure={form.error} />}
      {group &&
        (group.grid ? (
          <FixedGrid grid={group.grid} buildings={group.buildings} chosen={choice?.type} onChoose={setChosen} />
        ) : (
          <GroupRows label={group.label} buildings={group.buildings} chosen={choice?.type} onChoose={setChosen} />
        ))}
      {choice && <Chosen choice={choice} form={form} entityId={target.entityId} />}
    </div>
  );
}

/**
 * A group in its fixed places: the troop types' heads where it has them, then a tile a cell, its painting and its
 * name (a troop building by its tier, under its type), locked while it cannot rise. An empty cell keeps its place.
 */
const FixedGrid = ({
  grid,
  buildings,
  chosen,
  onChoose,
}: {
  grid: ConstructionGrid;
  buildings: Choice[];
  chosen: BuildingType | undefined;
  onChoose: (building: BuildingType) => void;
}) => (
  <div className="grid grid-cols-3 gap-2">
    {grid.heads?.map((head) => (
      <span
        key={head}
        role="columnheader"
        className="flex items-center justify-center gap-1.5 text-hud-label text-hud-ink"
      >
        <SemanticIcon name={resourceMeaning(TROOP_HEADS[head].painting)} size={20} />
        {TROOP_HEADS[head].name}
      </span>
    ))}
    {grid.rows.flatMap((row, tier) =>
      row.map((type, column) => {
        const building = type === null ? undefined : buildings.find((each) => each.type === type);
        return building ? (
          <button
            key={building.type}
            type="button"
            aria-pressed={building.type === chosen}
            data-building={building.type}
            title={building.reason}
            onClick={() => onChoose(building.type)}
            className={cn(
              "flex w-full flex-col items-center gap-1 rounded-hud-control border p-1.5",
              building.type === chosen ? "border-hud-chosen bg-hud-hover" : "border-hud-line bg-hud-well",
            )}
          >
            <BuildingThumbnail
              building={building.type}
              alt=""
              className={cn("h-10 object-contain", building.disabled && "opacity-50")}
            />
            <span className="flex items-center gap-1 text-hud-strong text-hud-ink">
              {grid.heads ? <HudTierChip tier={(tier + 1) as 1 | 2 | 3} /> : building.label}
              {building.disabled && <SemanticIcon name="lock" size={12} />}
            </span>
          </button>
        ) : (
          <span key={`empty-${tier}-${column}`} aria-hidden />
        );
      }),
    )}
  </div>
);

/** A group without fixed places, in the game's own order: a row a building, what it gives and its cost painted. */
const GroupRows = ({
  label,
  buildings,
  chosen,
  onChoose,
}: {
  label: string;
  buildings: Choice[];
  chosen: BuildingType | undefined;
  onChoose: (building: BuildingType) => void;
}) => (
  <div role="listbox" aria-label={label} className="flex flex-col gap-1">
    {buildings.map((building) => (
      <HudRow
        key={building.type}
        selected={building.type === chosen}
        onClick={() => onChoose(building.type)}
        lead={<BuildingThumbnail building={building.type} className="size-10 object-contain" />}
        title={building.label}
        detail={
          <span className="flex flex-col gap-1">
            {building.gives && <span className="text-hud-good">{building.gives}</span>}
            <PaintedCost requirements={building.requirements} />
          </span>
        }
      />
    ))}
  </div>
);

/** The chosen building whole, as its hover writes it, then Build, or the reason it cannot rise. */
const Chosen = ({ choice, form, entityId }: { choice: Choice; form: Form; entityId: number }) => (
  <div className="flex flex-col gap-2 rounded-hud-control border border-hud-line bg-hud-well p-3">
    <div className="flex items-start gap-3">
      <BuildingThumbnail building={choice.type} alt="" className="size-16 object-contain" />
      <BuildingHover
        name={choice.label}
        building={choice.type}
        resource={getProducedResource(choice.type)}
        entityId={entityId}
        useSimpleCost={form.useSimpleCost}
        gives={choice.gives}
        requirements={choice.requirements}
      />
    </div>
    {choice.disabled ? (
      <p role="status" className="text-hud-body text-hud-bad">
        {choice.reason}
      </p>
    ) : (
      <span className="grid">
        <HudButton kind="primary" icon="build" onClick={() => form.build(choice.type)}>
          {BUILD}
        </HudButton>
      </span>
    )}
  </div>
);

/** A row's cost, each resource painted with its amount, in red while the realm holds less. */
const PaintedCost = ({ requirements }: { requirements: Choice["requirements"] }) => (
  <span className="flex flex-wrap gap-x-2 gap-y-1 tabular-nums">
    {requirements === undefined && "—"}
    {requirements?.map((cost) => (
      <span
        key={cost.resource}
        className={cn(
          "inline-flex items-center gap-0.5",
          cost.current === undefined || cost.current < cost.amount ? "text-hud-bad" : "text-hud-ink",
        )}
        title={resourceName(cost.resource)}
      >
        <SemanticIcon name={resourceMeaning(cost.resource)} alt={resourceName(cost.resource)} className="h-4 w-4" />
        {formatCharge(cost.amount)}
      </span>
    ))}
  </span>
);
