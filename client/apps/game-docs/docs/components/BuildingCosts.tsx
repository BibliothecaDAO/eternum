import { ETERNUM_CONFIG } from "@/utils/config";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import ResourceIcon from "./ResourceIcon";

type Props = {
  buildingType: BuildingType;
};

// Helper function to format numbers with commas
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount));
};

// Map resource IDs to their names
const resourceNames: Record<number, string> = {
  [ResourcesIds.Stone]: "Stone",
  [ResourcesIds.Coal]: "Coal",
  [ResourcesIds.Wood]: "Wood",
  [ResourcesIds.Copper]: "Copper",
  [ResourcesIds.Ironwood]: "Ironwood",
  [ResourcesIds.Obsidian]: "Obsidian",
  [ResourcesIds.Gold]: "Gold",
  [ResourcesIds.Silver]: "Silver",
  [ResourcesIds.Mithral]: "Mithral",
  [ResourcesIds.AlchemicalSilver]: "Alchemical Silver",
  [ResourcesIds.ColdIron]: "Cold Iron",
  [ResourcesIds.DeepCrystal]: "Deep Crystal",
  [ResourcesIds.Ruby]: "Ruby",
  [ResourcesIds.Diamonds]: "Diamonds",
  [ResourcesIds.Hartwood]: "Hartwood",
  [ResourcesIds.Ignium]: "Ignium",
  [ResourcesIds.TwilightQuartz]: "Twilight Quartz",
  [ResourcesIds.TrueIce]: "True Ice",
  [ResourcesIds.Adamantine]: "Adamantine",
  [ResourcesIds.Sapphire]: "Sapphire",
  [ResourcesIds.EtherealSilica]: "Ethereal Silica",
  [ResourcesIds.Dragonhide]: "Dragonhide",
  [ResourcesIds.Labor]: "Labor",
  [ResourcesIds.AncientFragment]: "Ancient Fragment",
  [ResourcesIds.Wheat]: "Wheat",
  [ResourcesIds.Fish]: "Fish",
};

export default function BuildingCosts({ buildingType }: Props) {
  const [activeMode, setActiveMode] = useState<"simple" | "complex">("simple");

  const config = ETERNUM_CONFIG();

  // Get costs directly from the config files
  const complexCosts = config.buildings.complexBuildingCosts[buildingType] || [];
  const simpleCosts = config.buildings.simpleBuildingCost[buildingType] || [];

  // Check if this is a resource building (Wood, Stone, etc)
  const isResourceBuilding =
    (buildingType >= BuildingType.ResourceStone && buildingType <= BuildingType.ResourceDragonhide) ||
    buildingType === BuildingType.ResourceWheat ||
    buildingType === BuildingType.ResourceFish;

  // Resource buildings have the same cost in both modes
  if (isResourceBuilding) {
    // Get costs directly from config
    const costs = config.buildings.complexBuildingCosts[buildingType] || [];

    return (
      <div className="my-4 p-4 bg-gray-900 rounded-lg">
        <div className="font-bold mb-3 text-lg">Building Costs</div>
        <div className="flex flex-row items-center gap-3">
          {costs.map((cost) => (
            <div key={cost.resource} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-md">
              <ResourceIcon id={cost.resource} name={resourceNames[cost.resource]} size="xs" />
              <div className="flex flex-col">
                <span className="font-medium text-sm">{resourceNames[cost.resource]}</span>
                <span className="font-semibold">{formatAmount(cost.amount)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-400">
          Note: Resource buildings have the same cost in both Simple and Complex modes.
        </div>
      </div>
    );
  }

  // For T2 and T3 military buildings (complex mode only)
  const isComplexOnly =
    buildingType === BuildingType.ResourceKnightT2 ||
    buildingType === BuildingType.ResourceCrossbowmanT2 ||
    buildingType === BuildingType.ResourcePaladinT2 ||
    buildingType === BuildingType.ResourceKnightT3 ||
    buildingType === BuildingType.ResourceCrossbowmanT3 ||
    buildingType === BuildingType.ResourcePaladinT3;

  if (simpleCosts.length === 0 && complexCosts.length === 0) return null;

  return (
    <div className="my-4 p-4 bg-gray-900 rounded-lg">
      <div className="font-bold mb-3 text-lg">Building Costs</div>

      {isComplexOnly ? (
        <div>
          <div className="mb-2 text-amber-400 font-medium">Complex Mode Only</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {complexCosts.map((cost) => (
              <div key={cost.resource} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-md">
                <ResourceIcon id={cost.resource} name={resourceNames[cost.resource]} size="xs" />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{resourceNames[cost.resource]}</span>
                  <span className="font-semibold">{formatAmount(cost.amount)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-gray-400">
            Note: T2 and T3 military buildings can only be constructed in Complex mode.
          </div>
        </div>
      ) : (
        <div>
          <div className="flex space-x-2 mb-4">
            <button
              className={`px-4 py-2 rounded-md ${
                activeMode === "simple" ? "bg-amber-700 text-white" : "bg-gray-800 text-gray-300"
              }`}
              onClick={() => setActiveMode("simple")}
            >
              Simple (Labor)
            </button>
            <button
              className={`px-4 py-2 rounded-md ${
                activeMode === "complex" ? "bg-amber-700 text-white" : "bg-gray-800 text-gray-300"
              }`}
              onClick={() => setActiveMode("complex")}
            >
              Complex (Raw Resources)
            </button>
          </div>

          {activeMode === "simple" && (
            <div className="grid grid-cols-1 gap-2">
              {simpleCosts.map((cost) => (
                <div key={cost.resource} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-md">
                  <ResourceIcon id={cost.resource} name={resourceNames[cost.resource]} size="xs" />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{resourceNames[cost.resource]}</span>
                    <span className="font-semibold">{formatAmount(cost.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeMode === "complex" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {complexCosts.map((cost) => (
                <div key={cost.resource} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-md">
                  <ResourceIcon id={cost.resource} name={resourceNames[cost.resource]} size="xs" />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{resourceNames[cost.resource]}</span>
                    <span className="font-semibold">{formatAmount(cost.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
