import {
  UnifiedArmyCreationDrawer,
  useArmiesInRadius,
  useExplorersByStructure,
  useGuardsByStructure,
} from "@/features/armies";
import { cn } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { DefenseSlots } from "@/shared/ui/defense-slots";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";

import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { AlertTriangle, Eye, Shield, Swords, Users } from "lucide-react";
import { useMemo, useState } from "react";

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

export function MilitaryTab({}: MilitaryTabProps) {
  const { selectedRealm } = useStore();
  const { armies, isLoading } = useArmiesInRadius(selectedRealm ? selectedRealm.position : null, 20);
  const [isArmyCreationOpen, setIsArmyCreationOpen] = useState(false);
  const [armyCreationType, setArmyCreationType] = useState<"explorer" | "defense">("explorer");

  const {
    setup: { components },
  } = useDojo();

  const structure = useComponentValue(
    components.Structure,
    getEntityIdFromKeys([BigInt(selectedRealm?.entityId || 0)]),
  );

  const explorers = useExplorersByStructure({
    structureEntityId: selectedRealm?.entityId || 0,
  });

  const { guards, isLoading: isLoadingGuards } = useGuardsByStructure(selectedRealm?.entityId || 0);

  const cooldownSlots = useMemo(() => {
    const slotsTimeLeft: { slot: number; timeLeft: number }[] = [];
    guards.forEach((guard) => {
      if (guard.cooldownEnd > Date.now() / 1000) {
        slotsTimeLeft.push({ slot: guard.slot, timeLeft: guard.cooldownEnd - Date.now() / 1000 });
      }
    });
    return slotsTimeLeft;
  }, [guards]);

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

  const handleCreateArmy = (type: "explorer" | "defense") => {
    setArmyCreationType(type);
    setIsArmyCreationOpen(true);
  };

  const isRealmOrVillage = structure?.category === StructureType.Realm || structure?.category === StructureType.Village;

  return (
    <div className="space-y-6">
      {/* Military Overview */}
      {selectedRealm && structure && (
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h4 className="text-sm font-semibold">Explorers</h4>
            </div>
            <div className="text-lg font-bold">
              {explorers.length} / {structure.base.troop_max_explorer_count}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-green-500/10 border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-green-500" />
              <h4 className="text-sm font-semibold">Guards</h4>
            </div>
            <div className="text-lg font-bold">
              {isLoadingGuards ? "..." : `${guards.length} / ${structure.base.troop_max_guard_count}`}
            </div>
          </div>
        </div>
      )}

      {/* Army Creation Buttons */}
      {selectedRealm && structure && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Army Management</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleCreateArmy("explorer")}
              disabled={!isRealmOrVillage || explorers.length >= structure.base.troop_max_explorer_count}
              className="flex items-center gap-2 h-12"
              variant="outline"
            >
              <Swords className="w-4 h-4" />
              <div className="text-left">
                <div className="text-sm font-medium">Create Attack</div>
                <div className="text-xs opacity-70">
                  {explorers.length}/{structure.base.troop_max_explorer_count}
                </div>
              </div>
            </Button>

            <Button
              onClick={() => handleCreateArmy("defense")}
              disabled={guards.length >= structure.base.troop_max_guard_count}
              className="flex items-center gap-2 h-12"
              variant="outline"
            >
              <Shield className="w-4 h-4" />
              <div className="text-left">
                <div className="text-sm font-medium">Create Defense</div>
                <div className="text-xs opacity-70">
                  {isLoadingGuards ? "..." : `${guards.length}/${structure.base.troop_max_guard_count}`}
                </div>
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Defenses */}
      {selectedRealm && structure && !isLoadingGuards && (
        <DefenseSlots
          maxDefenses={structure.base.troop_max_guard_count}
          troops={guards}
          cooldownSlots={cooldownSlots}
          structureId={selectedRealm.entityId}
          onDefenseUpdated={() => {
            // Refresh guards data - this would typically trigger a refetch
            // The useGuardsByStructure hook should handle automatic updates
          }}
        />
      )}

      {/* Nearby Enemy Armies */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Nearby Enemy Armies</h3>
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
          <p className="text-sm text-muted-foreground">No enemy armies nearby</p>
        )}
      </div>

      {/* Army Creation Drawer */}
      {selectedRealm && (
        <UnifiedArmyCreationDrawer
          isOpen={isArmyCreationOpen}
          onOpenChange={setIsArmyCreationOpen}
          structureId={selectedRealm.entityId}
          maxDefenseSlots={structure?.base.troop_max_guard_count || 4}
          isExplorer={armyCreationType === "explorer"}
          onSuccess={() => {
            // Refresh data after successful army creation
            // The hooks should handle automatic updates
          }}
        />
      )}
    </div>
  );
}
