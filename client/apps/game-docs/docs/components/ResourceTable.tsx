import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds } from "@bibliothecadao/types";

export default function ResourceTable() {
  const config = ETERNUM_CONFIG();

  // Filter out troop types, lords, and special resources
  const resourceTypes = Object.values(ResourcesIds).filter(
    (id): id is number =>
      typeof id === "number" &&
      id !== ResourcesIds.Lords &&
      id !== ResourcesIds.Labor &&
      id !== ResourcesIds.AncientFragment &&
      id < ResourcesIds.Donkey, // Exclude troops and special resources
  );

  // Helper function to get resource name
  const getResourceName = (id: number) => {
    const resourceNames: Record<number, string> = {
      [ResourcesIds.Wood]: "Wood",
      [ResourcesIds.Stone]: "Stone",
      [ResourcesIds.Coal]: "Coal",
      [ResourcesIds.Copper]: "Copper",
      [ResourcesIds.Obsidian]: "Obsidian",
      [ResourcesIds.Silver]: "Silver",
      [ResourcesIds.Ironwood]: "Ironwood",
      [ResourcesIds.ColdIron]: "Cold Iron",
      [ResourcesIds.Gold]: "Gold",
      [ResourcesIds.Hartwood]: "Hartwood",
      [ResourcesIds.Diamonds]: "Diamonds",
      [ResourcesIds.Sapphire]: "Sapphire",
      [ResourcesIds.Ruby]: "Ruby",
      [ResourcesIds.DeepCrystal]: "Deep Crystal",
      [ResourcesIds.Ignium]: "Ignium",
      [ResourcesIds.EtherealSilica]: "Ethereal Silica",
      [ResourcesIds.TrueIce]: "True Ice",
      [ResourcesIds.TwilightQuartz]: "Twilight Quartz",
      [ResourcesIds.AlchemicalSilver]: "Alchemical Silver",
      [ResourcesIds.Adamantine]: "Adamantine",
      [ResourcesIds.Mithral]: "Mithral",
      [ResourcesIds.Dragonhide]: "Dragonhide",
      [ResourcesIds.Wheat]: "Wheat",
      [ResourcesIds.Fish]: "Fish",
    };

    return resourceNames[id] || `Resource ${id}`;
  };

  return (
    <div className="my-4">
      <div className="font-bold mb-6 text-xl">Resources</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Resources Section */}
        <div className="border border-gray-700 p-4 rounded-lg bg-white/5">
          <div className="font-bold mb-4">Basic Resources</div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="font-semibold">Resource</div>
            <div className="font-semibold">Weight (g)</div>
            <div className="font-semibold">Production</div>
          </div>

          {[ResourcesIds.Wheat, ResourcesIds.Fish].map((id) => (
            <div key={id} className="grid grid-cols-3 gap-2 py-2 border-t border-gray-700">
              <div>{getResourceName(id)}</div>
              <div>{config.resources.resourceWeightsGrams[id] / 1000000}</div>
              <div>{config.resources.productionBySimpleRecipeOutputs[id]}</div>
            </div>
          ))}
        </div>

        {/* Starting Resources */}
        <div className="border border-gray-700 p-4 rounded-lg bg-white/5">
          <div className="font-bold mb-4">Starting Resources</div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="font-semibold">Resource</div>
            <div className="font-semibold">Realm</div>
            <div className="font-semibold">Village</div>
          </div>

          {config.startingResources.map(({ resource, amount }) => (
            <div key={resource} className="grid grid-cols-3 gap-2 py-2 border-t border-gray-700">
              <div>{getResourceName(resource)}</div>
              <div>{amount.toLocaleString()}</div>
              <div>
                {config.villageStartingResources.find((r) => r.resource === resource)?.amount.toLocaleString() || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Resource Table */}
      <div className="mt-6 border border-gray-700 p-4 rounded-lg bg-white/5">
        <div className="font-bold mb-4">Resource Production</div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2">Resource</th>
                <th className="text-right py-2">Weight (kg)</th>
                <th className="text-right py-2">Output (p/s)</th>
                <th className="text-left py-2">Inputs</th>
                <th className="text-right py-2">Labor Value</th>
              </tr>
            </thead>
            <tbody>
              {resourceTypes.map((id) => {
                const inputs = config.resources.productionByComplexRecipe[id] || [];
                return (
                  <tr key={id} className="border-b border-gray-700">
                    <td className="py-3">{getResourceName(id)}</td>
                    <td className="text-right">{config.resources.resourceWeightsGrams[id] / 1000000}</td>
                    <td className="text-right">{config.resources.productionByComplexRecipeOutputs[id]}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {inputs.map((input) => (
                          <div key={input.resource} className="flex justify-between">
                            <span>{getResourceName(input.resource)}:</span>
                            <span className="text-gray-400">{input.amount}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">{config.resources.laborOutputPerResource[id]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Production System */}
      <div className="mt-6 border border-gray-700 p-4 rounded-lg bg-white/5">
        <div className="font-bold mb-4">Simple Production System</div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2">Resource</th>
                <th className="text-right py-2">Output (p/s)</th>
                <th className="text-left py-2">Labor Input</th>
                <th className="text-left py-2">Food Input</th>
              </tr>
            </thead>
            <tbody>
              {resourceTypes.map((id) => {
                const inputs = config.resources.productionBySimpleRecipe[id] || [];
                const laborInput = inputs.find((input) => input.resource === ResourcesIds.Labor);
                const foodInput = inputs.find(
                  (input) => input.resource === ResourcesIds.Wheat || input.resource === ResourcesIds.Fish,
                );

                return (
                  <tr key={id} className="border-b border-gray-700">
                    <td className="py-3">{getResourceName(id)}</td>
                    <td className="text-right">{config.resources.productionBySimpleRecipeOutputs[id]}</td>
                    <td>{laborInput ? laborInput.amount : "-"}</td>
                    <td>
                      {foodInput ? (
                        <div className="flex items-center gap-2">
                          <span>{getResourceName(foodInput.resource)}</span>
                          <span className="text-gray-400">{foodInput.amount}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
