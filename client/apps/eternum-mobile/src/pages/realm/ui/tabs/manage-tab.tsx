import { ProductionWidget } from "@/widgets/production-widget";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useCallback } from "react";

// Dummy data for labor buildings
const dummyLaborBuildings = [
  {
    id: "1",
    resourceId: ResourcesIds.Stone,
    productionTimeLeft: 3600, // 1 hour
    isActive: true,
    outputAmount: 100,
    population: 2,
    hasLaborMode: true,
    inputs: [
      { resourceId: ResourcesIds.Wood, amount: 10 },
      { resourceId: ResourcesIds.Coal, amount: 5 },
    ],
    laborInputs: [
      { resourceId: ResourcesIds.Lords, amount: 2 },
      { resourceId: ResourcesIds.Wheat, amount: 5 },
      { resourceId: ResourcesIds.Fish, amount: 3 },
    ],
    consumptionRates: [
      { resourceId: ResourcesIds.Wood, amount: 0.5 },
      { resourceId: ResourcesIds.Coal, amount: 0.2 },
    ],
    laborConsumptionRates: [
      { resourceId: ResourcesIds.Lords, amount: 0.1 },
      { resourceId: ResourcesIds.Wheat, amount: 0.3 },
      { resourceId: ResourcesIds.Fish, amount: 0.2 },
    ],
  },
  {
    id: "2",
    resourceId: ResourcesIds.ColdIron,
    productionTimeLeft: 7200, // 2 hours
    isActive: true,
    outputAmount: 50,
    population: 3,
    hasLaborMode: false,
    inputs: [
      { resourceId: ResourcesIds.Coal, amount: 15 },
      { resourceId: ResourcesIds.Stone, amount: 8 },
    ],
    laborInputs: [],
    consumptionRates: [
      { resourceId: ResourcesIds.Coal, amount: 0.8 },
      { resourceId: ResourcesIds.Stone, amount: 0.4 },
    ],
    laborConsumptionRates: [],
  },
];

const dummyResourceBalances = [
  { resourceId: ResourcesIds.Wood, balance: 1000 },
  { resourceId: ResourcesIds.Coal, balance: 500 },
  { resourceId: ResourcesIds.Stone, balance: 800 },
  { resourceId: ResourcesIds.ColdIron, balance: 300 },
  { resourceId: ResourcesIds.Lords, balance: 100 },
  { resourceId: ResourcesIds.Wheat, balance: 1500 },
  { resourceId: ResourcesIds.Fish, balance: 1200 },
];

export function ManageTab() {
  const handleStartProduction = useCallback((buildingId: string, mode: "raw" | "labor") => {
    console.log("Start production", { buildingId, mode });
  }, []);

  const handlePauseProduction = useCallback((buildingId: string) => {
    console.log("Pause production", { buildingId });
  }, []);

  const handleExtendProduction = useCallback((buildingId: string, mode: "raw" | "labor") => {
    console.log("Extend production", { buildingId, mode });
  }, []);

  return (
    <div className="space-y-4">
      {dummyLaborBuildings.map((building) => (
        <ProductionWidget
          key={building.id}
          building={building}
          resourceBalances={dummyResourceBalances}
          onStartProduction={handleStartProduction}
          onPauseProduction={handlePauseProduction}
          onExtendProduction={handleExtendProduction}
        />
      ))}
    </div>
  );
}
