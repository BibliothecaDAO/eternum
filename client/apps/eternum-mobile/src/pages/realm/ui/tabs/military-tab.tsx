import { useArmiesInRadius } from "@/features/armies";
import { useStore } from "@/shared/store";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { ResourcesIds } from "@bibliothecadao/eternum";

export interface MilitaryTabProps {
  className?: string;
}

export function MilitaryTab({ className }: MilitaryTabProps) {
  const { selectedRealm } = useStore();
  const { armies, isLoading } = useArmiesInRadius(selectedRealm ? selectedRealm.position : null, 20);

  const getResourceIdForTroopType = (troopType: string): ResourcesIds => {
    switch (troopType) {
      case "Knight":
        return ResourcesIds.Knight;
      case "KnightT2":
        return ResourcesIds.KnightT2;
      case "KnightT3":
        return ResourcesIds.KnightT3;
      case "Crossbowman":
        return ResourcesIds.Crossbowman;
      case "CrossbowmanT2":
        return ResourcesIds.CrossbowmanT2;
      case "CrossbowmanT3":
        return ResourcesIds.CrossbowmanT3;
      case "Paladin":
        return ResourcesIds.Paladin;
      case "PaladinT2":
        return ResourcesIds.PaladinT2;
      case "PaladinT3":
        return ResourcesIds.PaladinT3;
      default:
        return ResourcesIds.Knight;
    }
  };

  const sortedArmies = armies.sort((a, b) => a.distance - b.distance);

  return (
    <>
      <h3 className="text-lg font-semibold mb-4">Military</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading armies...</p>
      ) : armies && armies.length > 0 ? (
        <div className="space-y-4">
          {sortedArmies.map((army) => (
            <div key={army.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Army #{army.id}</h4>
                <span className="text-xs text-muted-foreground">{army.distance} Hexes Away</span>
              </div>
              <ResourceAmount
                resourceId={getResourceIdForTroopType(army.troopType)}
                amount={army.count}
                size="lg"
                showName={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No armies nearby</p>
      )}
    </>
  );
}
