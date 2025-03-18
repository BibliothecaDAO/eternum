import { ResourceIcon } from "@/ui/elements/resource-icon";
import { BiomeType, configManager, ResourcesIds, TroopType } from "@bibliothecadao/eternum";

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
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <h4 className="text-xl font-bold mb-3 text-gold">Travel</h4>
        <ul className="space-y-2">
          <li>
            <span className="mr-2">🏃‍♂️</span>
            Stamina cost per hex by biome and troop type:
            <div className="overflow-x-auto mt-2">
              <table className="not-prose w-full p-2 border-gold/10">
                <thead>
                  <tr>
                    <th className="border border-gold/10 p-2">Biome</th>
                    <th className="border border-gold/10 p-2">
                      <ResourceIcon
                        className="mr-1 text-gold"
                        size="sm"
                        resource={ResourcesIds[ResourcesIds.Crossbowman]}
                      />
                    </th>
                    <th className="border border-gold/10 p-2">
                      <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Knight]} />
                    </th>
                    <th className="border border-gold/10 p-2">
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
                    <tr key={biome}>
                      <td className="border border-gold/10 p-2">{BiomeType[biome]}</td>
                      <td className="border border-gold/10 p-2 text-center">
                        {configManager.getTravelStaminaCost(biome, TroopType.Crossbowman)}
                      </td>
                      <td className="border border-gold/10 p-2 text-center">
                        {configManager.getTravelStaminaCost(biome, TroopType.Knight)}
                      </td>
                      <td className="border border-gold/10 p-2 text-center">
                        {configManager.getTravelStaminaCost(biome, TroopType.Paladin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </li>
          <li>
            <span className="mr-2">🍖</span>
            Consumes per hex / unit:
            <table className="not-prose w-full p-2 border-gold/10 mt-2">
              <thead>
                <tr>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon
                      className="mr-1 text-gold"
                      size="sm"
                      resource={ResourcesIds[ResourcesIds.Crossbowman]}
                    />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Knight]} />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Paladin]} />
                  </th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).travelFishBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).travelFishBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).travelFishBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                  </td>
                </tr>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).travelWheatBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).travelWheatBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).travelWheatBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Wheat]} />
                  </td>
                </tr>
              </tbody>
            </table>
          </li>
        </ul>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <h4 className="text-xl font-bold mb-3 text-gold">Explore</h4>
        <ul className="space-y-2">
          <li className="flex items-center">
            <span className="mr-2">🌎</span>
            Costs <span className="font-semibold text-brilliance mx-1">
              {configManager.getExploreStaminaCost()}
            </span>{" "}
            stamina per hex
          </li>
          <li>
            <span className="mr-2">🍖</span>
            Consumes per hex / unit:
            <table className="not-prose w-full p-2 border-gold/10 mt-2">
              <thead>
                <tr>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon
                      className="mr-1 text-gold"
                      size="sm"
                      resource={ResourcesIds[ResourcesIds.Crossbowman]}
                    />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Knight]} />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Paladin]} />
                  </th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).exploreFishBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).exploreFishBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).exploreFishBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                  </td>
                </tr>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman).exploreWheatBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Knight).exploreWheatBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {configManager.getTravelFoodCostConfig(ResourcesIds.Paladin).exploreWheatBurnAmount}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Wheat]} />
                  </td>
                </tr>
              </tbody>
            </table>
          </li>
        </ul>
      </div>
    </div>
  );
};
