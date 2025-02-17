import { ArrivedDonkeys } from "@/widgets/arrived-donkeys";
import { LaborWidget } from "@/widgets/labor-widget";
import { NearbyEnemies } from "@/widgets/nearby-enemies";
import { ResourcesCard } from "@/widgets/resources-card";
import { UpgradeCastle } from "@/widgets/upgrade-castle";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useCallback } from "react";
import { useRealmTabs } from "../realm-page";

// Dummy data for labor buildings
const dummyLaborBuildings = [
  {
    id: "1",
    resourceId: ResourcesIds.Stone,
    productionTimeLeft: 3600, // 1 hour
    isActive: true,
    outputAmount: 100,
    inputs: [
      { resourceId: ResourcesIds.Wood, amount: 10 },
      { resourceId: ResourcesIds.Coal, amount: 5 },
    ],
    laborInputs: [
      { resourceId: ResourcesIds.Lords, amount: 2 },
      { resourceId: ResourcesIds.Wheat, amount: 5 },
      { resourceId: ResourcesIds.Fish, amount: 3 },
    ],
  },
  {
    id: "2",
    resourceId: ResourcesIds.ColdIron,
    productionTimeLeft: 7200, // 2 hours
    isActive: true,
    outputAmount: 50,
    inputs: [
      { resourceId: ResourcesIds.Coal, amount: 15 },
      { resourceId: ResourcesIds.Stone, amount: 8 },
    ],
    laborInputs: [
      { resourceId: ResourcesIds.Lords, amount: 3 },
      { resourceId: ResourcesIds.Wheat, amount: 8 },
      { resourceId: ResourcesIds.Fish, amount: 5 },
    ],
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

export function OverviewTab() {
  const { switchTab } = useRealmTabs();

  const handleUpgrade = async () => {
    // Simulate network delay
    await new Promise((resolve, reject) => setTimeout(Math.random() < 0.5 ? reject : resolve, 2000));
  };

  const handleViewEnemies = useCallback(() => {
    switchTab("military");
  }, [switchTab]);

  const handleClaimDonkeys = useCallback(() => {
    switchTab("claim");
  }, [switchTab]);

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
      <ResourcesCard />

      <div className="overflow-x-auto">
        <div className="grid grid-flow-col auto-cols-[80%] sm:auto-cols-[45%] gap-4 pb-4">
          {dummyLaborBuildings.map((building) => (
            <LaborWidget
              key={building.id}
              building={building}
              resourceBalances={dummyResourceBalances}
              onStartProduction={handleStartProduction}
              onPauseProduction={handlePauseProduction}
              onExtendProduction={handleExtendProduction}
            />
          ))}
        </div>
      </div>

      <UpgradeCastle castleLevel={1} onUpgrade={handleUpgrade} />

      <div className="grid grid-cols-2 gap-4">
        <NearbyEnemies entityId={1} onView={handleViewEnemies} />
        <ArrivedDonkeys entityId={2} onClaim={handleClaimDonkeys} />
      </div>
    </div>
  );
}
