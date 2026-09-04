import { ResourceIcon } from "@/ui/design-system/molecules";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, ResourcesIds, TroopType } from "@bibliothecadao/types";

export const ExplorationTable = () => {
  // All biome types
  const biomeTypes = [
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

  // All troop types
  const troopTypes = [TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin];

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-gold/20 overflow-hidden bg-gold/5 p-4">
        <h4 className="text-xl font-bold mb-3 text-light-pink">Travel</h4>
        <ul className="space-y-4">
          <li className="space-y-2">
            <span className="mr-2">🏃‍♂️</span>
            <span className="text-gray-200">Stamina cost per hex by biome and troop type:</span>
            <div className="overflow-x-auto mt-2">
              <div className="rounded-lg border border-gold/20 overflow-hidden">
                <table className="not-prose w-full">
                  <thead className="bg-gold/5">
                    <tr className="border-b border-gold/20">
                      <th className="text-left p-4 text-light-pink">Biome</th>
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Crossbowman]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Knight]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Paladin]}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {biomeTypes.map((biome) => (
                      <tr key={biome} className="border-b border-gold/10 hover:bg-gold/10 transition-colors">
                        <td className="p-3">{BiomeType[biome]}</td>
                        <td className="p-3 text-center">
                          {configManager.getTravelStaminaCost(biome, TroopType.Crossbowman)}
                        </td>
                        <td className="p-3 text-center">
                          {configManager.getTravelStaminaCost(biome, TroopType.Knight)}
                        </td>
                        <td className="p-3 text-center">
                          {configManager.getTravelStaminaCost(biome, TroopType.Paladin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </li>
          <li className="space-y-2">
            <span className="mr-2">🍖</span>
            <span className="text-gray-200">Consumes per hex / unit:</span>
            <div className="mt-2">
              <div className="rounded-lg border border-gold/20 overflow-hidden">
                <table className="not-prose w-full">
                  <thead className="bg-gold/5">
                    <tr className="border-b border-gold/20">
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Crossbowman]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Knight]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Paladin]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gold/10 hover:bg-gold/10 transition-colors">
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).travelFishBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).travelFishBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).travelFishBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                      </td>
                    </tr>
                    <tr className="hover:bg-gold/10 transition-colors">
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).travelWheatBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).travelWheatBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).travelWheatBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Wheat]} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-gold/20 overflow-hidden bg-gold/5 p-4">
        <h4 className="text-xl font-bold mb-3 text-light-pink">Explore</h4>
        <ul className="space-y-4">
          <li className="flex items-center">
            <span className="mr-2">🌎</span>
            <span className="text-gray-200">
              Costs <span className="font-semibold text-brilliance mx-1">{configManager.getExploreStaminaCost()}</span>{" "}
              stamina per hex
            </span>
          </li>
          <li className="space-y-2">
            <span className="mr-2">🍖</span>
            <span className="text-gray-200">Consumes per hex / unit:</span>
            <div className="mt-2">
              <div className="rounded-lg border border-gold/20 overflow-hidden">
                <table className="not-prose w-full">
                  <thead className="bg-gold/5">
                    <tr className="border-b border-gold/20">
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Crossbowman]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Knight]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink">
                        <ResourceIcon
                          className="mr-1 text-gold"
                          size="sm"
                          resource={ResourcesIds[ResourcesIds.Paladin]}
                        />
                      </th>
                      <th className="text-center p-4 text-light-pink"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gold/10 hover:bg-gold/10 transition-colors">
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).exploreFishBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).exploreFishBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).exploreFishBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                      </td>
                    </tr>
                    <tr className="hover:bg-gold/10 transition-colors">
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).exploreWheatBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).exploreWheatBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).exploreWheatBurnAmount}
                      </td>
                      <td className="p-3 text-center">
                        <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Wheat]} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};
