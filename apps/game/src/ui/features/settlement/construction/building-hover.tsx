import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { type ResourceRequirement } from "@/ui/design-system/molecules/requirement-chips";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { adjustWonderLordsCost } from "@/ui/utils/utils";
import { configManager } from "@bibliothecadao/eternum";
import {
  type BuildingType,
  formatExact,
  formatFigure,
  resourceName,
  ResourcesIds,
  formatCharge,
  formatAmount,
} from "@bibliothecadao/types";
import clsx from "clsx";

/**
 * A building card's hover, the one place its numbers are written: its name and the population it takes, what one more
 * gives, what building it costs against what the realm holds (red while short), and, for a producer, what its
 * production burns ("2 Copper from 1 Wheat · 0.3 Wood"), since that is what keeps it running.
 */
export const BuildingHover = ({
  name,
  building,
  resource,
  entityId,
  useSimpleCost,
  gives,
  requirements,
}: {
  name: string;
  building: BuildingType;
  resource: ResourcesIds | undefined;
  entityId: number | undefined;
  useSimpleCost: boolean;
  gives: string | null | undefined;
  requirements: ResourceRequirement[] | undefined;
}) => {
  const structure = useNativeRow(
    "Structure",
    entityId === undefined ? undefined : { game_id: configManager.getActiveGameId(), entity_id: entityId },
  );
  const population = configManager.getBuildingCategoryConfig(building).population_cost;
  const recipe =
    resource === undefined ? null : recipeLine(resource, useSimpleCost, Boolean(structure?.metadata.has_wonder));
  return (
    <div className="flex min-w-44 max-w-64 flex-col gap-1 text-left text-hud-label text-hud-ink">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-hud-strong">{name}</span>
        {population > 0 && <span className="text-hud-muted">{formatExact(population)} population</span>}
      </div>
      {gives && <span className="text-hud-good">{gives}</span>}
      <BuildCost requirements={requirements} />
      {recipe && <span className="text-hud-muted">{recipe}</span>}
    </div>
  );
};

/** What building it costs, a line per resource: its icon, its name, held / needed, red while short. */
const BuildCost = ({ requirements }: { requirements: ResourceRequirement[] | undefined }) => {
  if (requirements === undefined) return <span className="text-hud-muted">Cost unknown</span>;
  if (requirements.length === 0) return <span className="text-hud-muted">Free to build</span>;
  return (
    <ul aria-label="Build cost">
      {requirements.map(({ resource, amount, current }) => (
        <li
          key={resource}
          className={clsx(
            "flex items-center gap-2",
            current !== undefined && current < amount ? "text-hud-bad" : "text-hud-ink",
          )}
        >
          <ResourceIcon resource={resource} size="xs" withTooltip={false} />
          <span className="flex-1">{resourceName(resource)}</span>
          <span className="text-right tabular-nums">
            {current === undefined ? "—" : formatAmount(Math.floor(current))} / {formatCharge(amount)}
          </span>
        </li>
      ))}
    </ul>
  );
};

/** One production cycle, what it makes from what it burns; null when it burns nothing or the recipe is unknown. */
const recipeLine = (resource: ResourcesIds, simple: boolean, hasWonder: boolean): string | null => {
  const read = configManager.getRecipeInputs(resource, simple);
  const output = configManager.getRecipeOutput(resource, simple);
  if (!read || read.length === 0 || !output) return null;
  const inputs = resource === ResourcesIds.Donkey && hasWonder ? adjustWonderLordsCost(read) : read;
  const burns = inputs.map(({ resource: input, amount }) => `${formatFigure(amount)} ${resourceName(input)}`);
  return `${formatFigure(output)} ${resourceName(resource)} from ${burns.join(" · ")}`;
};
