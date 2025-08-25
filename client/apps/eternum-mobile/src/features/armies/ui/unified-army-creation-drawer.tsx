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
import {
  ArmyManager,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  getTroopName,
  getTroopResourceId,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { DEFENSE_NAMES, Direction, ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { AlertTriangle, Plus, Shield, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface UnifiedArmyCreationDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  structureId: ID;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  onSuccess?: () => void;
}

const DirectionButton = ({
  direction,
  label,
  availableDirections,
  selectedDirection,
  onClick,
}: {
  direction: Direction;
  label: string;
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  onClick: (direction: Direction) => void;
}) => {
  const isAvailable = availableDirections.includes(direction);
  const isSelected = selectedDirection === direction;

  return (
    <Button
      variant={isSelected ? "default" : isAvailable ? "outline" : "ghost"}
      size="sm"
      onClick={() => isAvailable && onClick(direction)}
      disabled={!isAvailable}
      className={cn(
        "aspect-square text-lg font-bold",
        isSelected && "bg-blue-500 text-white",
        !isAvailable && "opacity-30",
      )}
    >
      {label}
    </Button>
  );
};

export function UnifiedArmyCreationDrawer({
  isOpen,
  onOpenChange,
  structureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
  onSuccess,
}: UnifiedArmyCreationDrawerProps) {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const dojo = useDojo();
  const armyManager = useMemo(() => {
    return new ArmyManager(dojo.setup.systemCalls, components, structureId);
  }, [structureId, components, dojo.setup.systemCalls]);

  const [isLoading, setIsLoading] = useState(false);
  const [freeDirections, setFreeDirections] = useState<Direction[]>([]);
  const [isLoadingDirections, setIsLoadingDirections] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(direction || null);
  const [selectedTroopType, setSelectedTroopType] = useState<TroopType>(TroopType.Crossbowman);
  const [selectedTier, setSelectedTier] = useState<TroopTier>(TroopTier.T1);
  const [troopCount, setTroopCount] = useState(0);
  const [guardSlot, setGuardSlot] = useState(0);
  const [armyType, setArmyType] = useState(isExplorer);

  // Load available directions for explorer armies
  useEffect(() => {
    const fetchDirections = async () => {
      if (!armyType) return;

      setIsLoadingDirections(true);
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureId)]));

      if (structure) {
        try {
          // For now, we'll assume all directions are available - in a real implementation
          // you would fetch tile data to check which are free using getNeighborHexes
          const allDirections = [
            Direction.NORTH_EAST,
            Direction.EAST,
            Direction.SOUTH_EAST,
            Direction.SOUTH_WEST,
            Direction.WEST,
            Direction.NORTH_WEST,
          ];
          setFreeDirections(allDirections);
        } catch (error) {
          console.error("Failed to fetch directions:", error);
          setFreeDirections([]);
        }
      }
      setIsLoadingDirections(false);
    };

    fetchDirections();
  }, [structureId, armyType, components]);

  // Auto-select first available direction
  useEffect(() => {
    if (freeDirections.length > 0 && selectedDirection === null) {
      setSelectedDirection(freeDirections[0]);
    }
  }, [freeDirections, selectedDirection]);

  const getMaxAffordable = () => {
    const resourceId = getTroopResourceId(selectedTroopType, selectedTier);
    const balance = getBalance(structureId, resourceId, Date.now(), components).balance;
    return divideByPrecision(balance);
  };

  const getTroopBalance = (troopType: TroopType, tier: TroopTier) => {
    const resourceId = getTroopResourceId(troopType, tier);
    return getBalance(structureId, resourceId, Date.now(), components).balance;
  };

  const incrementTroopCount = (amount: number) => {
    setTroopCount(Math.min(troopCount + amount, maxAffordable));
  };

  const setMaxTroopCount = () => {
    setTroopCount(maxAffordable);
  };

  const handleCreate = async () => {
    if (!armyManager || troopCount <= 0) return;

    setIsLoading(true);

    try {
      if (armyType) {
        if (selectedDirection === null) {
          throw new Error("No direction selected");
        }
        await armyManager.createExplorerArmy(account, selectedTroopType, selectedTier, troopCount, selectedDirection);
      } else {
        await armyManager.addTroopsToGuard(account, selectedTroopType, selectedTier, troopCount, guardSlot);
      }

      onSuccess?.();
      onOpenChange(false);
      setTroopCount(0);
    } catch (error) {
      console.error("Failed to create army:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const troops = [
    { troopType: TroopType.Crossbowman, name: "Crossbowman" },
    { troopType: TroopType.Knight, name: "Knight" },
    { troopType: TroopType.Paladin, name: "Paladin" },
  ];

  const maxAffordable = getMaxAffordable();
  const canCreate = troopCount > 0 && troopCount <= maxAffordable && (!armyType || selectedDirection !== null);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            {armyType ? <Swords className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            Create {armyType ? "Attack" : "Defense"} Army
          </DrawerTitle>
          <DrawerDescription>
            {armyType ? "Create an explorer army to attack enemies" : "Create a defense army to protect your structure"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6 overflow-y-auto flex-1">
          {/* Army Type Toggle */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Army Type</h4>
            <Tabs
              value={armyType ? "explorer" : "defense"}
              onValueChange={(value) => setArmyType(value === "explorer")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="explorer" className="flex items-center gap-2">
                  <Swords className="w-4 h-4" />
                  Attack
                </TabsTrigger>
                <TabsTrigger value="defense" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Defense
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Defense Slot Selection */}
          {!armyType && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Defense Slot</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DEFENSE_NAMES).map(([slotIndex, slotName]) => {
                  const slot = parseInt(slotIndex);
                  const isSelected = guardSlot === slot;
                  const isSlotAvailable = slot < maxDefenseSlots;

                  return (
                    <Button
                      key={slot}
                      variant={isSelected ? "default" : isSlotAvailable ? "outline" : "ghost"}
                      onClick={() => isSlotAvailable && setGuardSlot(slot)}
                      disabled={!isSlotAvailable}
                      className={cn(
                        "p-3 flex flex-col items-center text-center",
                        isSelected && "bg-blue-500 text-white",
                        !isSlotAvailable && "opacity-30",
                      )}
                    >
                      <div className="font-semibold text-sm">{slotName}</div>
                      <div className="text-xs opacity-70">Slot {slot + 1}</div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tier Selection */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Select Tier</h4>
            <Tabs value={selectedTier} onValueChange={(value) => setSelectedTier(value as TroopTier)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value={TroopTier.T1}>Tier 1</TabsTrigger>
                <TabsTrigger value={TroopTier.T2}>Tier 2</TabsTrigger>
                <TabsTrigger value={TroopTier.T3}>Tier 3</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Troop Type Selection */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Select Troop Type</h4>
            <div className="space-y-3">
              {troops.map((troop) => {
                const balance = getTroopBalance(troop.troopType, selectedTier);
                const isSelected = selectedTroopType === troop.troopType;
                const troopResourceId = getTroopResourceId(troop.troopType, selectedTier);

                return (
                  <div
                    key={troop.troopType}
                    className={cn(
                      "border rounded-lg p-4 transition-all cursor-pointer",
                      isSelected ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50",
                    )}
                    onClick={() => setSelectedTroopType(troop.troopType)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold">{getTroopName(troop.troopType, selectedTier)}</h5>
                    </div>

                    <div className="flex items-center justify-between">
                      <ResourceAmount
                        resourceId={troopResourceId}
                        amount={divideByPrecision(balance)}
                        size="sm"
                        showName={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Troop Count */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Troop Count</h4>
            <div className="flex gap-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => incrementTroopCount(100)}
                disabled={troopCount >= maxAffordable}
              >
                +100
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => incrementTroopCount(500)}
                disabled={troopCount >= maxAffordable}
              >
                +500
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={setMaxTroopCount}
                disabled={troopCount >= maxAffordable}
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

          {/* Direction Selection (for explorers only) */}
          {armyType && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Spawn Direction</h4>
              {isLoadingDirections ? (
                <div className="text-center py-4">Loading directions...</div>
              ) : freeDirections.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  <DirectionButton
                    direction={Direction.NORTH_WEST}
                    label="↖"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div />
                  <DirectionButton
                    direction={Direction.NORTH_EAST}
                    label="↗"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <DirectionButton
                    direction={Direction.WEST}
                    label="←"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div className="flex items-center justify-center text-2xl">🏰</div>
                  <DirectionButton
                    direction={Direction.EAST}
                    label="→"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <DirectionButton
                    direction={Direction.SOUTH_WEST}
                    label="↙"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div />
                  <DirectionButton
                    direction={Direction.SOUTH_EAST}
                    label="↘"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                </div>
              ) : (
                <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded">
                  <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <p className="text-red-500 text-sm">No adjacent tiles available for army deployment</p>
                </div>
              )}
            </div>
          )}

          {/* Resource Validation */}
          {troopCount > maxAffordable && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-red-500 font-medium">Insufficient Resources</span>
              </div>
              <p className="text-xs text-red-500/80">
                Need {troopCount.toLocaleString()}, have {maxAffordable.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <DrawerFooter>
          <Button onClick={handleCreate} disabled={!canCreate} className="w-full" size="lg">
            {isLoading ? (
              "Creating..."
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create {armyType ? "Attack" : "Defense"} Army
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
