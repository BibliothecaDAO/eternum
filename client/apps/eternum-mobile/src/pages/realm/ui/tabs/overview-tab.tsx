import { useResourceArrivals } from "@/features/resource-arrivals";
import { useStore } from "@/shared/store";
import { ArrivedDonkeys } from "@/widgets/arrived-donkeys";
import { NearbyEnemies } from "@/widgets/nearby-enemies";
import { ResourcesCard } from "@/widgets/resources-card";
import { UpgradeCastle } from "@/widgets/upgrade-castle";
import { useCallback } from "react";
import { ProductionWidgetsSection } from "../components/production-widgets-section";
import { useRealmTabs } from "../realm-page";

export function OverviewTab() {
  const { switchTab } = useRealmTabs();
  const structureEntityId = useStore((state) => state.structureEntityId);
  const selectedRealm = useStore((state) => state.selectedRealm);
  const { summary } = useResourceArrivals(structureEntityId);

  const handleViewEnemies = useCallback(() => {
    switchTab("military");
  }, [switchTab]);

  const handleClaimDonkeys = useCallback(() => {
    switchTab("claim");
  }, [switchTab, summary.readyArrivals]);

  return (
    <div className="space-y-4">
      <ResourcesCard entityId={structureEntityId} />

      {selectedRealm && <ProductionWidgetsSection selectedRealm={selectedRealm} />}

      <UpgradeCastle realmEntityId={structureEntityId} />

      <div className="grid grid-cols-2 gap-4">
        <NearbyEnemies onView={handleViewEnemies} />
        <ArrivedDonkeys
          onClaim={handleClaimDonkeys}
          readyCount={summary.readyArrivals}
          pendingCount={summary.pendingArrivals}
        />
      </div>
    </div>
  );
}
