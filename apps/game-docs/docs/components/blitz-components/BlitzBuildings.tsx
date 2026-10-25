import { BuildingType, buildingName, ResourcesIds } from "@bibliothecadao/types";
import { ETERNUM_CONFIG } from "@/utils/config";
import { formatAmount } from "../styles";
import { nameOf } from "./blitz-resources";

type Cost = { resource: number; amount: number };

/** A building's costs in one table; a building the table does not price has none there. */
const costsIn = (table: Record<number, Cost[]>, type: number): Cost[] => (type in table ? table[type] : []);
const costLine = (costs: Cost[]) =>
  costs.length ? costs.map((cost) => `${formatAmount(cost.amount)} ${nameOf(cost.resource)}`).join(", ") : "—";

/**
 * Every building a Blitz realm can raise, as the game's config prices it: what it makes, the population it takes (a
 * workers' hut adds capacity instead), and its cost paid in labor alone or in resources. Research is left out, as the
 * production tables leave it: Blitz studies nothing.
 */
export const BlitzBuildings = ({ group }: { group: "economic" | "resources" | "military" }) => {
  const { buildingPopulation, buildingCapacity, buildingResourceProduced, simpleBuildingCost, complexBuildingCosts } =
    ETERNUM_CONFIG("blitz").buildings;
  const produced = (type: number) => Number(type in buildingResourceProduced ? buildingResourceProduced[type] : 0);
  const isTroop = (type: number) => produced(type) >= ResourcesIds.Knight && produced(type) <= ResourcesIds.PaladinT3;
  const isEconomic = (type: number) =>
    type === BuildingType.WorkersHut || produced(type) === ResourcesIds.Wheat || produced(type) === ResourcesIds.Donkey;
  const buildable = Object.keys(buildingPopulation)
    .map(Number)
    .filter((type) => costsIn(simpleBuildingCost, type).length + costsIn(complexBuildingCosts, type).length > 0)
    .filter((type) => produced(type) !== ResourcesIds.Research);
  const rows = buildable.filter((type) =>
    group === "military"
      ? isTroop(type)
      : group === "economic"
        ? isEconomic(type)
        : !isTroop(type) && !isEconomic(type),
  );

  return (
    <table>
      <thead>
        <tr>
          <th>Building</th>
          <th>Makes</th>
          <th>Population</th>
          <th>Labor cost</th>
          <th>Resource cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((type) => (
          <tr key={type}>
            <td>{buildingName(type, false)}</td>
            <td>{type === BuildingType.WorkersHut ? "Population" : nameOf(produced(type))}</td>
            <td>
              {type === BuildingType.WorkersHut
                ? `+${formatAmount(buildingCapacity[type])} capacity`
                : formatAmount(buildingPopulation[type])}
            </td>
            <td>{costLine(costsIn(simpleBuildingCost, type))}</td>
            <td>{costLine(costsIn(complexBuildingCosts, type))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
