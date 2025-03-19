import { useResourceArrivals } from "@/features/resource-arrivals";
import { useStore } from "@/shared/store";
import { ArrivedDonkeys } from "@/widgets/arrived-donkeys";
import { NearbyEnemies } from "@/widgets/nearby-enemies";
import { ResourcesCard } from "@/widgets/resources-card";
import { UpgradeCastle } from "@/widgets/upgrade-castle";
import { useCallback } from "react";
import { LaborWidgetsSection } from "../components/labor-widgets-section";
import { useRealmTabs } from "../realm-page";

export function OverviewTab() {
  const { switchTab } = useRealmTabs();
  const structureEntityId = useStore((state) => state.structureEntityId);
  const selectedRealm = useStore((state) => state.selectedRealm);
  const { summary } = useResourceArrivals(structureEntityId);

  const handleUpgrade = async () => {
    // Simulate network delay
    await new Promise((resolve, reject) => setTimeout(Math.random() < 0.5 ? reject : resolve, 2000));
  };

  const handleViewEnemies = useCallback(() => {
    switchTab("military");
  }, [switchTab]);

  const handleClaimDonkeys = useCallback(() => {
    if (summary.readyArrivals > 0) {
      switchTab("claim");
    }
  }, [switchTab, summary.readyArrivals]);

  return (
    <div className="space-y-4">
      <ResourcesCard entityId={structureEntityId} />

      {selectedRealm && <LaborWidgetsSection selectedRealm={selectedRealm} />}

      <UpgradeCastle castleLevel={1} onUpgrade={handleUpgrade} />

      <div className="grid grid-cols-2 gap-4">
        <NearbyEnemies entityId={1} onView={handleViewEnemies} />
        <ArrivedDonkeys
          entityId={structureEntityId}
          onClaim={handleClaimDonkeys}
          readyCount={summary.readyArrivals}
          pendingCount={summary.pendingArrivals}
        />
      </div>
    </div>
  );
}
