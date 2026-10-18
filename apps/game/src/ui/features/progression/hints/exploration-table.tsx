import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, ResourcesIds, TroopType } from "@bibliothecadao/types";

import { ReferenceTable } from "./article";

const BIOMES = [
  BiomeType.Ocean,
  BiomeType.DeepOcean,
  BiomeType.Beach,
  BiomeType.Grassland,
  BiomeType.Shrubland,
  BiomeType.SubtropicalDesert,
  BiomeType.TemperateDesert,
  BiomeType.TropicalRainForest,
  BiomeType.TropicalSeasonalForest,
  BiomeType.TemperateRainForest,
  BiomeType.TemperateDeciduousForest,
  BiomeType.Tundra,
  BiomeType.Taiga,
  BiomeType.Snow,
  BiomeType.Bare,
  BiomeType.Scorched,
];

/** The three troops, each by its resource, in the tables' column order. */
const TROOPS = [
  { type: TroopType.Crossbowman, resource: ResourcesIds.Crossbowman },
  { type: TroopType.Knight, resource: ResourcesIds.Knight },
  { type: TroopType.Paladin, resource: ResourcesIds.Paladin },
] as const;

const troopHeads = TROOPS.map(({ resource }) => <ResourceIcon key={resource} size="sm" resource={resource} />);

/** What each troop burns of one food per hex, as a row of the food table. */
const foodRow = (food: ResourcesIds.Fish | ResourcesIds.Wheat, burn: (troop: ResourcesIds) => number) => ({
  key: food,
  label: food === ResourcesIds.Fish ? "Fish" : "Wheat",
  cells: [...TROOPS.map(({ resource }) => burn(resource)), <ResourceIcon key="food" size="sm" resource={food} />],
});

const FoodTable = ({ explore }: { explore: boolean }) => {
  const config = (troop: ResourcesIds) => configManager.getTravelFoodCostConfig(troop);
  return (
    <ReferenceTable
      label={explore ? "Food an explore burns per hex and unit" : "Food travel burns per hex and unit"}
      cols="1fr 1fr 1fr 40px"
      head={[...troopHeads, ""]}
      rows={[
        foodRow(ResourcesIds.Fish, (troop) =>
          explore ? config(troop).exploreFishBurnAmount : config(troop).travelFishBurnAmount,
        ),
        foodRow(ResourcesIds.Wheat, (troop) =>
          explore ? config(troop).exploreWheatBurnAmount : config(troop).travelWheatBurnAmount,
        ),
      ]}
    />
  );
};

export const ExplorationTable = () => (
  <div className="grid grid-cols-2 gap-4">
    <HudPanel title="Travel" collapsible={false}>
      <div className="flex flex-col gap-4">
        <p>🏃‍♂️ Stamina cost per hex by biome and troop type:</p>
        <ReferenceTable
          label="Stamina per hex by biome and troop"
          cols="2fr 1fr 1fr 1fr"
          head={["Biome", ...troopHeads]}
          rows={BIOMES.map((biome) => ({
            key: biome,
            label: BiomeType[biome],
            cells: [BiomeType[biome], ...TROOPS.map(({ type }) => configManager.getTravelStaminaCost(biome, type))],
          }))}
        />
        <p>🍖 Consumes per hex / unit:</p>
        <FoodTable explore={false} />
      </div>
    </HudPanel>

    <HudPanel title="Explore" collapsible={false}>
      <div className="flex flex-col gap-4">
        <p>
          🌎 Costs <span className="text-hud-strong text-hud-accent">{configManager.getExploreStaminaCost()}</span>{" "}
          stamina per hex
        </p>
        <p>🍖 Consumes per hex / unit:</p>
        <FoodTable explore />
      </div>
    </HudPanel>
  </div>
);
