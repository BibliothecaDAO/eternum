import { ResourcesCard } from "@/widgets/resources-card";
import { UpgradeCastle } from "@/widgets/upgrade-castle";

export function OverviewTab() {
  const handleUpgrade = async () => {
    // Simulate network delay
    await new Promise((resolve, reject) => setTimeout(Math.random() < 0.5 ? reject : resolve, 2000));
  };

  return (
    <div className="space-y-4">
      <ResourcesCard />
      <UpgradeCastle castleLevel={1} onUpgrade={handleUpgrade} />
    </div>
  );
}
