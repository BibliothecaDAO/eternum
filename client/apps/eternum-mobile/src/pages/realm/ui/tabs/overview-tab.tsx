import { NearbyEnemies } from "@/widgets/nearby-enemies";
import { ResourcesCard } from "@/widgets/resources-card";
import { UpgradeCastle } from "@/widgets/upgrade-castle";
import { useCallback } from "react";
import { useRealmTabs } from "../realm-page";

export function OverviewTab() {
  const { switchTab } = useRealmTabs();

  const handleUpgrade = async () => {
    // Simulate network delay
    await new Promise((resolve, reject) => setTimeout(Math.random() < 0.5 ? reject : resolve, 2000));
  };

  const handleViewEnemies = useCallback(() => {
    switchTab("military");
  }, [switchTab]);

  return (
    <div className="space-y-4">
      <ResourcesCard />
      <UpgradeCastle castleLevel={1} onUpgrade={handleUpgrade} />
      <div className="grid grid-cols-2 gap-4">
        <NearbyEnemies entityId={1} onView={handleViewEnemies} />
        <NearbyEnemies entityId={2} onView={handleViewEnemies} />
      </div>
    </div>
  );
}
