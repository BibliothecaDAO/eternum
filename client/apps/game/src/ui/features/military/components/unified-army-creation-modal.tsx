import { sqlApi } from "@/services/api";
import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ModalContainer } from "@/ui/shared/components/modal-container";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  ArmyManager,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  getTroopResourceId,
} from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
import {
  DEFENSE_NAMES,
  Direction,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  resources,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
      variant={isSelected ? "gold" : isAvailable ? "outline" : "secondary"}
      size="md"
      onClick={() => isAvailable && onClick(direction)}
      disabled={!isAvailable}
      className={clsx(
        "aspect-square text-2xl lg:text-3xl font-bold transition-all duration-300 transform rounded-xl",
        "min-h-[56px] lg:min-h-[64px]",
        "min-w-[56px] lg:min-w-[64px]",
        isSelected
          ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-110 bg-gradient-to-br from-gold/25 to-gold/15"
          : isAvailable
            ? "hover:bg-gold/15 hover:border-gold/60 hover:scale-105 hover:shadow-lg cursor-pointer hover:-translate-y-0.5"
            : "cursor-not-allowed opacity-40",
        "border-2 backdrop-blur-sm",
      )}
    >
      <span className="drop-shadow-md">{label}</span>
    </Button>
  );
};

interface UnifiedArmyCreationModalProps {
  structureId: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
}

export const UnifiedArmyCreationModal = ({
  structureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
}: UnifiedArmyCreationModalProps) => {
  const dojo = useDojo();
  const {
    setup: { components },
    account: { account },
  } = dojo;

  const [isLoading, setIsLoading] = useState(false);
  const [freeDirections, setFreeDirections] = useState<Direction[]>([]);
  const [isLoadingDirections, setIsLoadingDirections] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(
    direction !== undefined ? direction : null,
  );
  const [selectedTroopCombo, setSelectedTroopCombo] = useState<{ type: TroopType; tier: TroopTier }>({
    type: TroopType.Crossbowman,
    tier: TroopTier.T1,
  });
  const [troopCount, setTroopCount] = useState(0);
  const [guardSlot, setGuardSlot] = useState(0);
  const [armyType, setArmyType] = useState(isExplorer);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  // Get current structure data
  const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureId)]));

  // Get current army counts for validation
  const explorers = useExplorersByStructure({
    structureEntityId: structureId,
  });

  const { data: guardsData } = useQuery({
    queryKey: ["guards", String(structureId)],
    queryFn: async () => {
      const guards = await sqlApi.fetchGuardsByStructure(structureId);
      return guards.filter((guard) => guard.troops?.count && guard.troops.count > 0n);
    },
    staleTime: 10000,
  });

  const currentExplorersCount = explorers.length;
  const currentGuardsCount = guardsData?.length || 0;
  const maxExplorers = structure?.base.troop_max_explorer_count || 0;
  const maxGuards = structure?.base.troop_max_guard_count || maxDefenseSlots;

  // Check if user can create armies
  const canCreateAttackArmy = currentExplorersCount < maxExplorers;
  const canCreateDefenseArmy = currentGuardsCount < maxGuards;
  const hasDefenseArmies = currentGuardsCount > 0;
  const canInteractWithDefense = canCreateDefenseArmy || hasDefenseArmies;

  const guardsBySlot = useMemo(() => {
    const map = new Map<number, NonNullable<typeof guardsData>[number]>();
    (guardsData ?? []).forEach((guard) => {
      map.set(Number(guard.slot), guard);
    });
    return map;
  }, [guardsData]);

  const selectedGuard = guardsBySlot.get(guardSlot);
  const selectedGuardCategory = selectedGuard?.troops?.category as TroopType | undefined;
  const selectedGuardTier = selectedGuard?.troops?.tier as TroopTier | undefined;
  const isSelectedSlotOccupied = Boolean(selectedGuard);
  const isDefenseSlotCompatible =
    !selectedGuard ||
    (selectedGuardCategory === selectedTroopCombo.type && selectedGuardTier === selectedTroopCombo.tier);
  const isDefenseSlotCreationBlocked = !isSelectedSlotOccupied && !canCreateDefenseArmy;
  const isDefenseTroopLocked = !armyType && isSelectedSlotOccupied;

  // Create army manager for the structure
  const armyManager = useMemo(() => {
    return new ArmyManager(dojo.setup.systemCalls, components, structureId);
  }, [structureId, components, dojo.setup.systemCalls]);

  // Auto-select the first troop with balance or fallback to first
  useEffect(() => {
    const troopTypes = [TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin];
    const troopTiers = [TroopTier.T1, TroopTier.T2, TroopTier.T3];

    // Check all combinations and find first one with balance
    let firstTroopWithBalance: { type: TroopType; tier: TroopTier } | null = null;

    for (const type of troopTypes) {
      for (const tier of troopTiers) {
        const balance = getBalance(
          structureId,
          getTroopResourceId(type, tier),
          getBlockTimestamp().currentDefaultTick,
          components,
        ).balance;

        const available = Number(divideByPrecision(balance) || 0);

        if (available > 0 && !firstTroopWithBalance) {
          firstTroopWithBalance = { type, tier };
          break;
        }
      }
      if (firstTroopWithBalance) break;
    }

    // If we found a troop with balance, use it; otherwise keep the default
    if (firstTroopWithBalance) {
      setSelectedTroopCombo(firstTroopWithBalance);
    }
  }, [structureId, components]);

  // Load available directions for explorer armies
  useEffect(() => {
    const fetchDirections = async () => {
      if (!armyType) return;

      setIsLoadingDirections(true);
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureId)]));

      if (structure) {
        const coords = getNeighborHexes(structure.base.coord_x, structure.base.coord_y);
        const tiles = await sqlApi.fetchTilesByCoords(coords.map((coord) => ({ col: coord.col, row: coord.row })));
        const freeTiles = tiles.filter((tile) => tile.occupier_id === 0);
        const directions = freeTiles.map((tile) =>
          getDirectionBetweenAdjacentHexes(
            { col: structure.base.coord_x, row: structure.base.coord_y },
            { col: tile.col, row: tile.row },
          ),
        );
        setFreeDirections(directions.filter((direction) => direction !== null) as Direction[]);
      }
      setIsLoadingDirections(false);
    };

    fetchDirections();
  }, [structureId, armyType, components]);

  // Auto-select first available direction
  useEffect(() => {
    if (freeDirections.length > 0 && selectedDirection === null && direction === undefined) {
      setSelectedDirection(freeDirections[0]);
    }
  }, [freeDirections, selectedDirection, direction]);

  // Auto-switch to available army type if current selection is not allowed
  useEffect(() => {
    if (armyType && !canCreateAttackArmy && canInteractWithDefense) {
      setArmyType(false);
    } else if (!armyType && !canInteractWithDefense && canCreateAttackArmy) {
      setArmyType(true);
    }
  }, [armyType, canCreateAttackArmy, canInteractWithDefense]);

  useEffect(() => {
    if (armyType) {
      return;
    }

    const occupiedSlots = (guardsData ?? [])
      .map((guard) => Number(guard.slot))
      .filter((slot) => Number.isInteger(slot) && slot >= 0);

    if (maxDefenseSlots > 0 && guardSlot >= maxDefenseSlots) {
      const clampedSlot = Math.max(0, maxDefenseSlots - 1);
      if (guardSlot !== clampedSlot) {
        setGuardSlot(clampedSlot);
      }
      return;
    }

    if (!canCreateDefenseArmy) {
      if (occupiedSlots.length === 0) {
        if (guardSlot !== 0) {
          setGuardSlot(0);
        }
        return;
      }

      if (!occupiedSlots.includes(guardSlot)) {
        const fallbackSlot = [...occupiedSlots].sort((a, b) => a - b)[0];
        if (fallbackSlot !== undefined) {
          setGuardSlot(fallbackSlot);
        }
      }
    }
  }, [armyType, guardsData, guardSlot, maxDefenseSlots, canCreateDefenseArmy]);

  useEffect(() => {
    if (armyType || !selectedGuardCategory || !selectedGuardTier) {
      return;
    }

    setSelectedTroopCombo((previous) => {
      if (previous.type === selectedGuardCategory && previous.tier === selectedGuardTier) {
        return previous;
      }
      setTroopCount(0);
      return { type: selectedGuardCategory, tier: selectedGuardTier };
    });
  }, [armyType, selectedGuardCategory, selectedGuardTier]);

  const handleCreate = async () => {
    if (!armyManager || troopCount <= 0) return;

    setIsLoading(true);

    try {
      if (armyType) {
        if (selectedDirection === null) {
          throw new Error("No direction selected");
        }
        await armyManager.createExplorerArmy(
          account,
          selectedTroopCombo.type,
          selectedTroopCombo.tier,
          troopCount,
          selectedDirection,
        );
      } else {
        if (!isDefenseSlotCompatible) {
          throw new Error("Selected defense slot requires matching troop type and tier");
        }
        if (isDefenseSlotCreationBlocked) {
          throw new Error("No available defense slot for new troops");
        }
        await armyManager.addTroopsToGuard(
          account,
          selectedTroopCombo.type,
          selectedTroopCombo.tier,
          troopCount,
          guardSlot,
        );
      }

      // Success - army created
    } catch (error) {
      console.error("Failed to create army:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const maxAffordable = useMemo(() => {
    const resourceId = getTroopResourceId(selectedTroopCombo.type, selectedTroopCombo.tier);
    const balance = getBalance(structureId, resourceId, currentDefaultTick, components).balance;
    return divideByPrecision(balance);
  }, [structureId, selectedTroopCombo.type, selectedTroopCombo.tier, currentDefaultTick, components]);
  const troopResource = resources.find(
    (r) => r.id === getTroopResourceId(selectedTroopCombo.type, selectedTroopCombo.tier),
  );

  const selectedGuardLabel =
    selectedGuardTier && selectedGuardCategory ? `${selectedGuardTier} ${selectedGuardCategory}` : null;

  const selectedGuardLabelUpper = selectedGuardLabel?.toUpperCase() ?? null;

  const defenseSlotErrorMessage = !armyType
    ? !isDefenseSlotCompatible && selectedGuardLabelUpper
      ? `Slot ${guardSlot + 1} currently contains ${selectedGuardLabelUpper}. Reinforce it with the same troop type and tier.`
      : isDefenseSlotCreationBlocked
        ? "All defense slots are occupied. Select an occupied slot to reinforce or remove one to free space."
        : null
    : null;

  const defenseSlotInfoMessage =
    !armyType && isDefenseTroopLocked && selectedGuardLabel
      ? `Reinforcing ${selectedGuardLabel}. Other troop types are locked for this slot.`
      : null;

  const isDefenseActionDisabled =
    !armyType && (!canInteractWithDefense || isDefenseSlotCreationBlocked || !isDefenseSlotCompatible);

  return (
    <ModalContainer title={armyType ? "Create Attack Army" : "Create Defense Army"} size="large">
      <div className="p-6 w-full h-full grid grid-cols-2 gap-6 bg-gradient-to-br from-brown/5 to-brown/10 rounded-lg">
        {/* LEFT HALF: Troop Selection */}
        <div className="flex flex-col h-full">
          {/* Troop Selection Grid */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-6">
              <h6 className="text-gold text-lg font-bold mb-1">SELECT TROOP TYPE</h6>
              <p className="text-gold/60 text-sm">Choose your troop type and tier</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin].map((type) => (
                <div key={type} className="space-y-3">
                  <div className="text-center">
                    <div className="text-gold/90 text-sm font-bold uppercase tracking-wide mb-2 border-b border-gold/30 pb-1">
                      {type === TroopType.Crossbowman ? "CROSSBOW" : type}
                    </div>
                  </div>
                  {[TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => {
                    const balance = getBalance(
                      structureId,
                      getTroopResourceId(type, tier),
                      currentDefaultTick,
                      components,
                    ).balance;

                    const isSelected = selectedTroopCombo.type === type && selectedTroopCombo.tier === tier;
                    const troopResourceForCard = resources.find((r) => r.id === getTroopResourceId(type, tier));
                    const available = Number(divideByPrecision(balance) || 0);
                    const hasResources = available > 0;
                    const isLockedOption =
                      isDefenseTroopLocked &&
                      selectedGuardCategory !== undefined &&
                      selectedGuardTier !== undefined &&
                      (type !== selectedGuardCategory || tier !== selectedGuardTier);
                    const canSelectCard = hasResources && !isLockedOption;

                    return (
                      <div
                        key={`${type}-${tier}`}
                        className={clsx(
                          "p-3 flex flex-col cursor-pointer transition-all duration-300 rounded-xl border-2 relative group transform",
                          "backdrop-blur-sm",
                          isSelected
                            ? "border-gold bg-gradient-to-br from-gold/25 to-gold/15 ring-2 ring-gold/40 shadow-xl shadow-gold/30 scale-105"
                            : canSelectCard
                              ? "border-brown/40 bg-gradient-to-br from-brown/15 to-brown/5 hover:border-gold/50 hover:bg-gradient-to-br hover:from-gold/20 hover:to-gold/10 hover:shadow-lg hover:scale-102 hover:-translate-y-0.5"
                              : "border-gray/20 bg-gray/5 opacity-50 cursor-not-allowed",
                          "hover:z-10 relative",
                          isLockedOption && "pointer-events-none",
                        )}
                        onClick={() => canSelectCard && setSelectedTroopCombo({ type, tier })}
                      >
                        {/* Tier Badge */}
                        <div className="absolute -top-2 -right-2 z-10">
                          <div
                            className={clsx(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-lg",
                              "transition-all duration-300 bg-brown",
                              hasResources ? getTierStyle(`T${tier}`) : "bg-gray/50  border-gray-400",
                              isSelected && "scale-110 shadow-gold/50",
                            )}
                          >
                            {tier}
                          </div>
                        </div>

                        {/* Resource Icon */}
                        <div
                          className={clsx(
                            "flex items-center justify-center p-3 rounded-lg mb-3 transition-all duration-300",
                            isSelected
                              ? "bg-gold/20 shadow-inner"
                              : hasResources
                                ? "bg-brown/20 group-hover:bg-gold/15"
                                : "bg-gray/10",
                          )}
                        >
                          <ResourceIcon resource={troopResourceForCard?.trait || ""} size="md" withTooltip={false} />
                        </div>

                        {/* Available Count */}
                        <div className="space-y-1">
                          <div
                            className={clsx(
                              "text-center text-base font-bold transition-colors duration-300",
                              isSelected ? "text-gold" : hasResources ? "text-gold/90" : "",
                            )}
                          >
                            {hasResources
                              ? available > 999
                                ? `${Math.floor(available / 1000)}k`
                                : available.toLocaleString()
                              : "0"}
                          </div>
                          <div
                            className={clsx(
                              "text-center text-xs font-medium transition-colors duration-300",
                              isSelected ? "text-gold/80" : "text-gold/50",
                            )}
                          >
                            available
                          </div>
                        </div>

                        {/* Selection Glow Effect */}
                        {isSelected && (
                          <div className="absolute inset-0 rounded-xl bg-gold/5 animate-pulse pointer-events-none" />
                        )}
                        {isLockedOption && (
                          <div className="absolute inset-0 rounded-xl bg-brown/70 backdrop-blur-sm flex items-center justify-center text-xs font-semibold text-gold/80 uppercase tracking-wide">
                            Locked
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Troop Count */}
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
            <div className="text-center mb-4">
              <h6 className="text-gold text-lg font-bold mb-1">TROOP COUNT</h6>
              <p className="text-gold/60 text-sm">Select the number of troops to deploy</p>
            </div>

            <div className="space-y-4">
              {/* Quick Add Buttons */}
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setTroopCount(Math.min(troopCount + 100, maxAffordable))}
                  disabled={troopCount >= maxAffordable}
                  className="px-4 py-2 font-semibold hover:bg-gold/10 transition-all duration-200"
                >
                  +100
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTroopCount(Math.min(troopCount + 500, maxAffordable))}
                  disabled={troopCount >= maxAffordable}
                  className="px-4 py-2 font-semibold hover:bg-gold/10 transition-all duration-200"
                >
                  +500
                </Button>
                <Button
                  variant="gold"
                  onClick={() => setTroopCount(maxAffordable)}
                  disabled={troopCount >= maxAffordable}
                  className="px-6 py-2 font-bold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  MAX
                </Button>
              </div>

              {/* Number Input */}
              <div className="space-y-2">
                <NumberInput max={maxAffordable} min={0} step={100} value={troopCount} onChange={setTroopCount} />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gold/60">Available:</span>
                  <span className="text-gold font-semibold">{maxAffordable.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resource Validation */}
          {troopCount > maxAffordable && (
            <div className="bg-gradient-to-r from-red/15 to-red/10 border-2 border-red/40 rounded-xl p-4 mt-4 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1 rounded-full bg-red/20">
                  <AlertTriangle className="w-5 h-5 text-red" />
                </div>
                <span className="text-red font-bold text-base">Insufficient Resources</span>
              </div>
              <p className="text-sm text-red/90 ml-8">
                You need <span className="font-bold">{troopCount.toLocaleString()}</span> troops but only have{" "}
                <span className="font-bold">{maxAffordable.toLocaleString()}</span> available
              </p>
            </div>
          )}
        </div>

        {/* RIGHT HALF: Army Type + Direction/Defense */}
        <div className="flex flex-col h-full space-y-6">
          {/* Army Type Toggle */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
            <div className="text-center mb-4">
              <h6 className="text-gold text-lg font-bold mb-1">ARMY TYPE</h6>
              <p className="text-gold/60 text-sm">Choose between attack or defense</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant={armyType ? "gold" : "outline"}
                onClick={() => setArmyType(true)}
                size="lg"
                disabled={!canCreateAttackArmy}
                className={clsx(
                  "flex-1 py-4 font-bold transition-all duration-300 relative rounded-xl",
                  "flex flex-col items-center gap-2",
                  armyType
                    ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-105"
                    : "hover:bg-gold/10 hover:scale-102",
                  !canCreateAttackArmy && "opacity-50 cursor-not-allowed",
                )}
              >
                <Users className="w-5 h-5" />
                <span>ATTACK</span>
                <div className="absolute -top-3 -right-3 bg-gradient-to-br from-gold/90 to-gold/70 text-brown text-xs px-2 py-1 rounded-full border-2 border-gold shadow-lg font-bold">
                  {currentExplorersCount}/{maxExplorers}
                </div>
              </Button>
              <Button
                variant={!armyType ? "gold" : "outline"}
                onClick={() => setArmyType(false)}
                size="lg"
                disabled={!canInteractWithDefense}
                className={clsx(
                  "flex-1 py-4 font-bold transition-all duration-300 relative rounded-xl",
                  "flex flex-col items-center gap-2",
                  !armyType
                    ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-105"
                    : "hover:bg-gold/10 hover:scale-102",
                  !canInteractWithDefense && "opacity-50 cursor-not-allowed",
                )}
              >
                <Shield className="w-5 h-5" />
                <span>DEFENSE</span>
                <div className="absolute -top-3 -right-3 bg-gradient-to-br from-gold/90 to-gold/70 text-brown text-xs px-2 py-1 rounded-full border-2 border-gold shadow-lg font-bold">
                  {currentGuardsCount}/{maxGuards}
                </div>
              </Button>
            </div>

            {/* Army Limit Warning */}
            {((armyType && !canCreateAttackArmy) || (!armyType && !canCreateDefenseArmy)) && (
              <div className="bg-gradient-to-r from-red/15 to-red/10 border-2 border-red/40 rounded-xl p-4 mt-4 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-1 rounded-full bg-red/20">
                    <AlertTriangle className="w-5 h-5 text-red" />
                  </div>
                  <span className="text-red font-bold text-base">Army Limit Reached</span>
                </div>
                <p className="text-sm text-red/90 ml-8">
                  {armyType
                    ? `Maximum attack armies (${maxExplorers}) created. Delete an existing army to create a new one.`
                    : hasDefenseArmies
                      ? `All defense slots (${maxGuards}) are occupied. Reinforce an existing slot or delete one to free space.`
                      : `This structure does not have available defense slots.`}
                </p>
              </div>
            )}
          </div>

          {/* Defense Slot Selection */}
          {!armyType && (
            <div className="flex-1 p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
              <div className="text-center mb-4">
                <h6 className="text-gold text-lg font-bold mb-1">DEFENSE SLOT</h6>
                <p className="text-gold/60 text-sm">Choose which defense slot to reinforce</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(DEFENSE_NAMES).map(([slotIndex, slotName]) => {
                  const slot = parseInt(slotIndex);
                  const isSelected = guardSlot === slot;
                  const isSlotAvailable = slot < maxDefenseSlots;
                  const guardInfo = guardsBySlot.get(slot);
                  const guardCategory = guardInfo?.troops?.category;
                  const guardTier = guardInfo?.troops?.tier;
                  const hasGuard = Boolean(guardInfo);
                  const isSlotSelectable = isSlotAvailable && (canCreateDefenseArmy || hasGuard);
                  const isSlotCompatible =
                    !guardInfo || (guardCategory === selectedTroopCombo.type && guardTier === selectedTroopCombo.tier);

                  return (
                    <Button
                      key={slot}
                      variant={isSelected ? "gold" : isSlotSelectable ? "outline" : "secondary"}
                      onClick={() => isSlotSelectable && setGuardSlot(slot)}
                      disabled={!isSlotSelectable}
                      size="lg"
                      className={clsx(
                        "p-4 flex flex-col items-center text-center transition-all duration-300 rounded-xl",
                        isSelected
                          ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-105 bg-gradient-to-br from-gold/25 to-gold/15"
                          : isSlotSelectable
                            ? "hover:bg-gold/10 hover:border-gold/50 hover:scale-102 hover:shadow-md"
                            : "opacity-40 cursor-not-allowed",
                        hasGuard && !isSlotCompatible && "border-red/50 hover:border-red/60",
                      )}
                    >
                      <div className="text-base font-bold mb-1">{slotName}</div>
                      <div
                        className={clsx(
                          "text-sm",
                          hasGuard ? (isSlotCompatible ? "text-gold/90" : "text-red/80 font-semibold") : "text-gold/70",
                        )}
                      >
                        {hasGuard ? `${guardTier} ${guardCategory}` : `Slot ${slot + 1}`}
                      </div>
                      {!canCreateDefenseArmy && !hasGuard && (
                        <div className="mt-1 text-xs text-gold/50">Occupied slots only</div>
                      )}
                      {hasGuard && !isSlotCompatible && (
                        <div className="mt-1 text-xs text-red/70">
                          Reinforce with {guardTier} {guardCategory}
                        </div>
                      )}
                    </Button>
                  );
                })}
              </div>
              {defenseSlotInfoMessage && (
                <div className="mt-4 bg-brown/15 border border-gold/30 rounded-xl p-4 text-sm text-gold/80">
                  {defenseSlotInfoMessage}
                </div>
              )}
              {defenseSlotErrorMessage && (
                <div className="mt-4 bg-gradient-to-r from-red/15 to-red/10 border-2 border-red/40 rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-red/20">
                      <AlertTriangle className="w-5 h-5 text-red" />
                    </div>
                    <span className="text-sm text-red/90">{defenseSlotErrorMessage}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Direction Selection (for attack armies) */}
          {armyType && (
            <div className="flex-1 p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
              <div className="text-center mb-4">
                <h6 className="text-gold text-lg font-bold mb-1">SPAWN DIRECTION</h6>
                <p className="text-gold/60 text-sm">Select where your army will deploy</p>
              </div>
              {isLoadingDirections ? (
                <div className="flex justify-center py-8">
                  <LoadingAnimation />
                </div>
              ) : freeDirections.length > 0 ? (
                <div className="grid grid-cols-3 gap-4 mx-auto w-full max-w-[320px]">
                  <DirectionButton
                    direction={Direction.SOUTH_WEST}
                    label="↖"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div />
                  <DirectionButton
                    direction={Direction.SOUTH_EAST}
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
                  <div className="flex items-center justify-center text-5xl lg:text-6xl drop-shadow-lg filter brightness-110">
                    🏰
                  </div>
                  <DirectionButton
                    direction={Direction.EAST}
                    label="→"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <DirectionButton
                    direction={Direction.NORTH_WEST}
                    label="↙"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div />
                  <DirectionButton
                    direction={Direction.NORTH_EAST}
                    label="↘"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                </div>
              ) : (
                <div className="text-center p-4 bg-gradient-to-r from-red/15 to-red/10 border-2 border-red/40 rounded-xl shadow-lg">
                  <div className="p-2 rounded-full bg-red/20 w-fit mx-auto mb-2">
                    <AlertTriangle className="w-6 h-6 text-red" />
                  </div>
                  <p className="text-red font-semibold">No adjacent tiles available</p>
                  <p className="text-red/80 text-sm mt-1">All surrounding tiles are occupied</p>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
            <Button
              variant="gold"
              onClick={handleCreate}
              disabled={
                troopCount <= 0 ||
                troopCount > maxAffordable ||
                isLoading ||
                (armyType && (selectedDirection === null || !canCreateAttackArmy)) ||
                isDefenseActionDisabled
              }
              isLoading={isLoading}
              className={clsx(
                "w-full py-5 text-lg font-bold transition-all duration-300 rounded-xl",
                "bg-gradient-to-br from-gold to-gold/80 hover:from-gold/90 hover:to-gold/70",
                "shadow-xl hover:shadow-2xl hover:shadow-gold/40",
                "border-2 border-gold/60 hover:border-gold/80",
                "transform hover:scale-[1.02] hover:-translate-y-0.5",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg",
              )}
            >
              <div className="flex items-center justify-center gap-3">
                {armyType ? <Users className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                <span className="drop-shadow-sm">
                  {armyType
                    ? "CREATE ATTACK ARMY"
                    : `ADD DEFENSE - ${DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]?.toUpperCase()}`}
                </span>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};
