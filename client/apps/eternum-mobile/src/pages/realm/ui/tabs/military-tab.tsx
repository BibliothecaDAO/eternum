import { useArmiesInRadius } from "@/features/armies";
import { cn } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { ResourcesIds } from "@bibliothecadao/types";
import { AlertTriangle, Eye, Swords } from "lucide-react";

export interface MilitaryTabProps {
  className?: string;
}

const getDangerLevel = (distance: number) => {
  if (distance < 6)
    return {
      level: "high",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      icon: AlertTriangle,
    };
  if (distance < 12)
    return {
      level: "medium",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: Swords,
    };
  return {
    level: "low",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: Eye,
  };
};

export function MilitaryTab({ }: MilitaryTabProps) {
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
      <h3 className="text-lg font-semibold mb-4">Nearby Armies</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading armies...</p>
      ) : armies && armies.length > 0 ? (
        <div className="space-y-4">
          {sortedArmies.map((army) => {
            const { color, bgColor, icon: Icon } = getDangerLevel(army.distance);
            return (
              <div key={army.id} className={cn("border rounded-lg p-3 space-y-2", bgColor)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", color)} />
                    <h4 className={cn("text-sm font-medium", color)}>Army #{army.id}</h4>
                  </div>
                  <span className="text-xs text-muted-foreground">{army.distance} Hexes Away</span>
                </div>
                <ResourceAmount
                  resourceId={getResourceIdForTroopType(army.troopType)}
                  amount={army.count}
                  size="lg"
                  showName={true}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No armies nearby</p>
      )}
    </>
  );
}
