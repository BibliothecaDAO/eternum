import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer";
import { NumericInput } from "@/shared/ui/numeric-input";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ArmyManager, divideByPrecision, getBalance, getTroopName, getTroopResourceId } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { DEFENSE_NAMES, ID, TroopTier, TroopType, Troops } from "@bibliothecadao/types";
import { Plus, Shield } from "lucide-react";
import { useEffect, useState } from "react";

export interface DefenseTroop {
  slot: number;
  troops: Troops;
}

interface ArmyCreationDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  structureId: ID;
  defenseSlot: number;
  existingDefense?: DefenseTroop;
  onSuccess?: () => void;
}

export function ArmyCreationDrawer({
  isOpen,
  onOpenChange,
  structureId,
  defenseSlot,
  existingDefense,
  onSuccess,
}: ArmyCreationDrawerProps) {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const dojo = useDojo();
  const armyManager = new ArmyManager(dojo.setup.systemCalls, dojo.setup.components, structureId);

  const [isLoading, setIsLoading] = useState(false);
  const [troopCount, setTroopCount] = useState(0);
  const [selectedTroopType, setSelectedTroopType] = useState<TroopType>(
    (existingDefense?.troops.category as TroopType) || TroopType.Crossbowman,
  );
  const [selectedTier, setSelectedTier] = useState<TroopTier>(
    (existingDefense?.troops.tier as TroopTier) || TroopTier.T1,
  );

  const defenseName = DEFENSE_NAMES[defenseSlot as keyof typeof DEFENSE_NAMES];
  const isUpdate = !!existingDefense && existingDefense.troops.count > 0n;

  useEffect(() => {
    if (existingDefense && existingDefense.troops.count > 0n) {
      setSelectedTroopType(existingDefense.troops.category as TroopType);
      setSelectedTier(existingDefense.troops.tier as TroopTier);
    }
  }, [existingDefense]);

  const getMaxAffordableTroops = () => {
    const resourceId = getTroopResourceId(selectedTroopType, selectedTier);
    const balance = getBalance(structureId, resourceId, Date.now(), components).balance;
    return divideByPrecision(balance);
  };

  const handleCreateDefense = async () => {
    if (troopCount === 0) return;

    setIsLoading(true);
    try {
      await armyManager.addTroopsToGuard(account, selectedTroopType, selectedTier, troopCount, defenseSlot);
      onSuccess?.();
      onOpenChange(false);
      setTroopCount(0);
    } catch (error) {
      console.error("Failed to create defense:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const troops = [
    { troopType: TroopType.Crossbowman, name: "Crossbowman" },
    { troopType: TroopType.Knight, name: "Knight" },
    { troopType: TroopType.Paladin, name: "Paladin" },
  ].filter((troop) => {
    if (!existingDefense || existingDefense.troops.count === 0n) return true;
    return existingDefense.troops.category === troop.troopType;
  });

  const maxAffordable = getMaxAffordableTroops();
  const canCreate = troopCount > 0 && troopCount <= maxAffordable;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {isUpdate ? "Update Defense" : "Add Defense"}: {defenseName}
          </DrawerTitle>
          <DrawerDescription>
            {isUpdate ? "Modify your defense troops" : "Create a new defense for your structure"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6">
          {/* Tier Selection - only show if no existing defense or empty */}
          {(!existingDefense || existingDefense.troops.count === 0n) && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Select Tier</h4>
              <Tabs
                value={selectedTier.toString()}
                onValueChange={(value) => setSelectedTier(parseInt(value) as unknown as TroopTier)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="1">Tier 1</TabsTrigger>
                  <TabsTrigger value="2">Tier 2</TabsTrigger>
                  <TabsTrigger value="3">Tier 3</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Troop Type Selection */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Select Troop Type</h4>
            <div className="space-y-3">
              {troops.map((troop) => {
                const balance = getBalance(
                  structureId,
                  getTroopResourceId(troop.troopType, selectedTier),
                  Date.now(),
                  components,
                ).balance;
                const isSelected = selectedTroopType === troop.troopType;
                const currentCount =
                  existingDefense?.troops.category === troop.troopType ? Number(existingDefense.troops.count) : 0;

                return (
                  <div
                    key={troop.troopType}
                    className={cn(
                      "border rounded-lg p-4 transition-all",
                      isSelected ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50",
                      (!existingDefense || existingDefense.troops.count === 0n) && "cursor-pointer",
                    )}
                    onClick={() => {
                      if (!existingDefense || existingDefense.troops.count === 0n) {
                        setSelectedTroopType(troop.troopType);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold">{getTroopName(troop.troopType, selectedTier)}</h5>
                      {currentCount > 0 && (
                        <span className="text-sm text-green-500 font-medium">
                          Current: {divideByPrecision(currentCount)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <ResourceAmount
                        resourceId={getTroopResourceId(troop.troopType, selectedTier)}
                        amount={0}
                        size="sm"
                        showName={false}
                      />
                      <span className="text-sm text-muted-foreground">
                        Available: {divideByPrecision(balance).toLocaleString()}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTroopCount(Math.min(troopCount + 100, maxAffordable));
                            }}
                          >
                            +100
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTroopCount(Math.min(troopCount + 500, maxAffordable));
                            }}
                          >
                            +500
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTroopCount(maxAffordable);
                            }}
                          >
                            MAX
                          </Button>
                        </div>

                        <NumericInput
                          value={troopCount}
                          onChange={setTroopCount}
                          max={maxAffordable}
                          label="Enter troop count"
                          description={`Max: ${maxAffordable.toLocaleString()}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button onClick={handleCreateDefense} disabled={!canCreate} className="w-full" size="lg">
            {isLoading ? (
              "Creating..."
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                {isUpdate ? "Update Defense" : "Add Defense"}
              </>
            )}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full" size="lg">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
