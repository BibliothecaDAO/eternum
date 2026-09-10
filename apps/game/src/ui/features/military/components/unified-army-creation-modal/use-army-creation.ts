import { useCurrentArmiesTick, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  ArmyManager,
  configManager,
  divideByPrecision,
  getBalance,
  getGuardsByStructure,
  getTroopResourceId,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  Direction,
  DISPLAYED_SLOT_NUMBER_MAP,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  GUARD_SLOT_NAMES,
  GuardSlot,
  ID,
  resources,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getStructureDefenseSlotLimit,
  getUnlockedGuardSlots,
  MAX_GUARD_SLOT_COUNT,
} from "../../utils/defense-slot-utils";
import { getGuardStaminaSnapshot } from "../../utils/guard-stamina";
import type { GuardSummary, SelectedTroopCombo, TroopSelectionOption } from "./types";
import { gameEntityKey } from "@/sync/game-scope";

import { useBlitzRealmProvision } from "@/ui/modules/entity-details/hooks/use-blitz-realm-provision";
import { resolveArmyCreationBlockedReason, resolveArmyTroopAvailability } from "./army-creation-policy";

interface ArmyCreationOptions {
  structureId: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  fixedContext?: boolean;
  onSubmit?: () => void;
}

const TROOP_TYPES: TroopType[] = [TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin];
const TROOP_TIERS: TroopTier[] = [TroopTier.T1, TroopTier.T2, TroopTier.T3];
const DEFAULT_TROOP_COMBO: SelectedTroopCombo = {
  type: TroopType.Crossbowman,
  tier: TroopTier.T1,
};

const formatTroopTypeLabel = (type: TroopType) => (type === TroopType.Crossbowman ? "CROSSBOW" : type);

export const useArmyCreation = ({
  structureId: activeStructureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
  initialGuardSlot,
  fixedContext = false,
  onSubmit,
}: ArmyCreationOptions) => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();
  const submittingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(
    direction !== undefined ? direction : null,
  );
  const [selectedTroopCombo, setSelectedTroopCombo] = useState<SelectedTroopCombo>(() => ({
    ...DEFAULT_TROOP_COMBO,
  }));
  const [troopCount, setTroopCount] = useState(0);
  const [guardSlot, setGuardSlot] = useState(initialGuardSlot ?? 0);
  const [armyType, setArmyType] = useState(isExplorer);
  const currentArmiesTick = useCurrentArmiesTick();
  const currentDefaultTick = useCurrentDefaultTick();
  const previousStructureIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialGuardSlot !== undefined) {
      setGuardSlot(initialGuardSlot);
    }
  }, [initialGuardSlot]);

  const structureComponent = useComponentValue(components.Structure, gameEntityKey([BigInt(activeStructureId || 0)]));
  const resourceComponent = useComponentValue(components.Resource, gameEntityKey([BigInt(activeStructureId)]));
  const provision = useBlitzRealmProvision(activeStructureId);

  const troopOptions = useMemo<TroopSelectionOption[]>(() => {
    if (!activeStructureId) {
      return TROOP_TYPES.map((type) => ({
        type,
        label: formatTroopTypeLabel(type),
        tiers: TROOP_TIERS.map((tier) => ({ tier, available: 0, resourceTrait: "" })),
      }));
    }

    return TROOP_TYPES.map((type) => ({
      type,
      label: formatTroopTypeLabel(type),
      tiers: TROOP_TIERS.map((tier) => {
        const resourceId = getTroopResourceId(type, tier);
        const balance = getBalance(activeStructureId, resourceId, currentDefaultTick, components).balance;
        const available = Number(divideByPrecision(balance));
        const resource = resources.find((item) => item.id === resourceId);
        if (!resource) throw new Error(`Missing troop resource ${resourceId}`);

        return {
          tier,
          available,
          resourceTrait: resource.trait,
        };
      }),
    }));
  }, [activeStructureId, currentDefaultTick, components, resourceComponent]);

  const structureBase = structureComponent?.base;
  const structureCategory = structureBase?.category as StructureType | undefined;
  const structureLevel = structureBase?.level ?? null;
  const troopCapacityLimit =
    structureLevel === null ? null : configManager.getMaxArmySize(structureLevel, selectedTroopCombo.tier);
  const guardCapacityFromStructureRaw = structureBase?.troop_max_guard_count ?? null;
  const guardCapacityFromStructure =
    guardCapacityFromStructureRaw !== null && guardCapacityFromStructureRaw !== undefined
      ? Number(guardCapacityFromStructureRaw)
      : null;

  const structureDefenseSlotLimit = useMemo(
    () => getStructureDefenseSlotLimit(structureCategory, structureLevel),
    [structureCategory, structureLevel],
  );

  const fallbackDefenseSlotLimit = maxDefenseSlots ?? MAX_GUARD_SLOT_COUNT;

  const resolvedMaxDefenseSlots = useMemo(() => {
    const candidates: number[] = [Math.max(0, fallbackDefenseSlotLimit)];

    if (typeof guardCapacityFromStructure === "number" && Number.isFinite(guardCapacityFromStructure)) {
      candidates.push(Math.max(0, guardCapacityFromStructure));
    }

    if (structureDefenseSlotLimit !== null && structureDefenseSlotLimit !== undefined) {
      candidates.push(Math.max(0, structureDefenseSlotLimit));
    }

    return Math.min(...candidates);
  }, [fallbackDefenseSlotLimit, guardCapacityFromStructure, structureDefenseSlotLimit]);

  const availableGuardSlots = useMemo(() => getUnlockedGuardSlots(resolvedMaxDefenseSlots), [resolvedMaxDefenseSlots]);
  const availableGuardSlotSet = useMemo(() => new Set(availableGuardSlots), [availableGuardSlots]);

  const guardsData = useMemo(
    () => (structureComponent ? getGuardsByStructure(structureComponent) : []),
    [structureComponent],
  );

  const currentExplorersCount = Number(structureBase?.troop_explorer_count ?? 0);
  const currentGuardsCount =
    guardsData?.filter(
      (guard) => guard.troops?.count && guard.troops.count > 0n && availableGuardSlotSet.has(Number(guard.slot)),
    ).length || 0;
  const maxExplorers = Number(structureBase?.troop_max_explorer_count ?? 0);

  const canCreateAttackArmy = currentExplorersCount < maxExplorers;
  const canCreateDefenseArmy = currentGuardsCount < resolvedMaxDefenseSlots;
  const hasDefenseArmies = currentGuardsCount > 0;
  const canInteractWithDefense = canCreateDefenseArmy || hasDefenseArmies;

  const guardsBySlot = useMemo(() => {
    const map = new Map<number, GuardSummary>();
    (guardsData ?? []).forEach((guard) => {
      const numericSlot = Number(guard.slot);
      if (!availableGuardSlotSet.has(numericSlot)) {
        return;
      }
      const troops = guard.troops;
      const count = troops && troops.count !== undefined ? divideByPrecision(Number(troops.count)) : undefined;
      const category = troops?.category as TroopType | undefined;
      const tier = troops?.tier as TroopTier | undefined;
      const staminaSnapshot = getGuardStaminaSnapshot(troops, currentArmiesTick);
      const staminaCurrent = staminaSnapshot?.current;
      const staminaMax = staminaSnapshot?.max;

      map.set(numericSlot, {
        slot: guard.slot,
        troops: troops
          ? {
              category,
              tier,
              count,
              staminaCurrent,
              staminaMax,
            }
          : null,
      });
    });
    return map;
  }, [guardsData, availableGuardSlotSet, currentArmiesTick]);

  const selectedGuard = guardsBySlot.get(guardSlot);
  const selectedGuardCountValue = Number(selectedGuard?.troops?.count ?? 0);
  const selectedGuardCount = Number.isFinite(selectedGuardCountValue) ? selectedGuardCountValue : 0;
  const capacityRemainingForSelector =
    troopCapacityLimit !== null
      ? armyType
        ? troopCapacityLimit
        : Math.max(troopCapacityLimit - selectedGuardCount, 0)
      : null;

  const selectedGuardCategory = selectedGuard?.troops?.category as TroopType | undefined;
  const selectedGuardTier = selectedGuard?.troops?.tier as TroopTier | undefined;
  // A slot is only truly "occupied" if it has troops with count > 0
  const isSelectedSlotOccupied = selectedGuardCount > 0;
  // Slot is compatible if empty (no guard or count = 0) OR same troop type/tier
  const isDefenseSlotCompatible =
    !selectedGuard ||
    selectedGuardCount === 0 ||
    (selectedGuardCategory === selectedTroopCombo.type && selectedGuardTier === selectedTroopCombo.tier);
  const isDefenseSlotCreationBlocked = !isSelectedSlotOccupied && !canCreateDefenseArmy;
  const structureCoordX = structureBase?.coord_x;
  const structureCoordY = structureBase?.coord_y;

  useEffect(() => {
    if (armyType || fixedContext) {
      return;
    }

    if (availableGuardSlots.length === 0) {
      if (guardSlot !== 0) {
        setGuardSlot(0);
      }
      return;
    }

    if (!availableGuardSlots.includes(guardSlot)) {
      setGuardSlot(availableGuardSlots[availableGuardSlots.length - 1] ?? 0);
    }
  }, [armyType, fixedContext, availableGuardSlots, guardSlot]);

  useEffect(() => {
    setArmyType(isExplorer);
  }, [isExplorer]);

  useEffect(() => {
    setSelectedDirection(direction !== undefined ? direction : null);
  }, [direction]);

  useEffect(() => {
    setTroopCount(0);
    setGuardSlot(initialGuardSlot ?? 0);
  }, [activeStructureId, initialGuardSlot]);

  const neighborHexes = useMemo(
    () =>
      structureCoordX === undefined || structureCoordY === undefined
        ? []
        : getNeighborHexes(structureCoordX, structureCoordY),
    [structureCoordX, structureCoordY],
  );
  const neighborTiles = useWorldSpatialTiles(neighborHexes);
  const freeDirections = useMemo(
    () =>
      neighborTiles
        .filter((tile) => Number(tile.occupierId) === 0)
        .map((tile) =>
          getDirectionBetweenAdjacentHexes({ col: structureCoordX ?? 0, row: structureCoordY ?? 0 }, tile.hexCoords),
        )
        .filter((candidate): candidate is Direction => candidate !== null),
    [neighborTiles, structureCoordX, structureCoordY],
  );

  const isDefenseTroopLocked = !armyType && isSelectedSlotOccupied;

  const armyManager = useMemo(() => {
    if (!activeStructureId) return null;
    return new ArmyManager(systemCalls, activeStructureId as ID);
  }, [activeStructureId, systemCalls]);

  useEffect(() => {
    if (previousStructureIdRef.current === activeStructureId) return;
    previousStructureIdRef.current = activeStructureId;
    const option = troopOptions.find((option) => option.tiers.some((tier) => tier.available >= 1));
    const tier = option?.tiers.find((tier) => tier.available >= 1);
    setSelectedTroopCombo(option && tier ? { type: option.type, tier: tier.tier } : DEFAULT_TROOP_COMBO);
  }, [activeStructureId, troopOptions]);

  useEffect(() => {
    if (freeDirections.length > 0 && selectedDirection === null && direction === undefined) {
      setSelectedDirection(freeDirections[0]);
    }
  }, [freeDirections, selectedDirection, direction]);

  useEffect(() => {
    if (fixedContext) return;
    if (armyType && !canCreateAttackArmy && canInteractWithDefense) {
      setArmyType(false);
    } else if (!armyType && !canInteractWithDefense && canCreateAttackArmy) {
      setArmyType(true);
    }
  }, [armyType, fixedContext, canCreateAttackArmy, canInteractWithDefense]);

  useEffect(() => {
    if (armyType || fixedContext) {
      return;
    }

    const occupiedSlots = (guardsData ?? [])
      .map((guard) => Number(guard.slot))
      .filter((slot) => Number.isInteger(slot) && slot >= 0 && availableGuardSlotSet.has(slot));

    if (!canCreateDefenseArmy) {
      if (occupiedSlots.length === 0) {
        if (guardSlot !== 0) {
          setGuardSlot(0);
        }
        return;
      }

      if (!occupiedSlots.includes(guardSlot)) {
        const fallbackSlot = occupiedSlots.toSorted((a, b) => a - b)[0];
        if (fallbackSlot !== undefined) {
          setGuardSlot(fallbackSlot);
        }
      }
    }
  }, [armyType, fixedContext, guardsData, guardSlot, canCreateDefenseArmy, availableGuardSlotSet]);

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

  const selectedAvailable = troopOptions
    .find((option) => option.type === selectedTroopCombo.type)
    ?.tiers.find((option) => option.tier === selectedTroopCombo.tier)?.available;
  if (selectedAvailable === undefined) throw new Error("Selected troop is missing from the army catalogue");
  const maxAffordable =
    capacityRemainingForSelector === null
      ? 0
      : resolveArmyTroopAvailability(selectedAvailable, capacityRemainingForSelector);

  useEffect(() => {
    setTroopCount((current) => Math.max(0, Math.min(current, maxAffordable)));
  }, [maxAffordable]);

  const selectedGuardLabel =
    selectedGuardTier && selectedGuardCategory ? `${selectedGuardTier} ${selectedGuardCategory}` : null;
  const selectedGuardLabelUpper = selectedGuardLabel?.toUpperCase() ?? null;

  const defenseSlotErrorMessage = !armyType
    ? !isDefenseSlotCompatible && selectedGuardLabelUpper
      ? `Slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} currently contains ${selectedGuardLabelUpper}. Reinforce it with the same troop type and tier.`
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

  const actionLabel = armyType
    ? "CREATE FIELD ARMY"
    : `ADD DEFENSE - ${GUARD_SLOT_NAMES[guardSlot as GuardSlot]?.toUpperCase()}`;

  const blockedReason = resolveArmyCreationBlockedReason({
    hasStructure: Boolean(structureComponent),
    needsProvision: Boolean(provision?.needsBootstrap),
    isExplorer: armyType,
    canCreateExplorer: canCreateAttackArmy,
    hasFreeDirection: selectedDirection !== null && freeDirections.includes(selectedDirection),
    hasGuardSlot: availableGuardSlotSet.has(guardSlot) && !isDefenseActionDisabled,
    capacityRemaining: capacityRemainingForSelector,
    available: selectedAvailable,
    troopCount,
    isLoading,
  });
  const isActionDisabled = blockedReason !== null;

  const handleCreate = async () => {
    if (!armyManager || isActionDisabled || submittingRef.current) return;
    const target = armyType
      ? selectedDirection === null
        ? null
        : { kind: "field" as const, direction: selectedDirection }
      : { kind: "guard" as const, slot: guardSlot };
    if (!target) return;

    submittingRef.current = true;
    setIsLoading(true);
    onSubmit?.();
    try {
      await submitArmyCreation(armyManager, account, selectedTroopCombo, troopCount, target);
    } catch (error) {
      console.error("Failed to create army:", error);
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleArmyTypeSelect = (isAttack: boolean) => setArmyType(isAttack);
  const handleDirectionSelect = (newDirection: Direction) => setSelectedDirection(newDirection);
  const handleTroopSelect = (type: TroopType, tier: TroopTier) => setSelectedTroopCombo({ type, tier });
  const handleGuardSlotSelect = (slot: number) => {
    if (!availableGuardSlotSet.has(slot)) {
      return;
    }
    setGuardSlot(slot);
  };
  const handleTroopCountChange = (value: number) => setTroopCount(Math.max(0, Math.min(value, maxAffordable)));

  return {
    troopOptions,
    selectedTroopCombo,
    selectedAvailable,
    isDefenseTroopLocked,
    selectedGuardCategory,
    selectedGuardTier,
    handleTroopSelect,
    troopCount,
    maxAffordable,
    handleTroopCountChange,
    capacityRemainingForSelector,
    troopCapacityLimit,
    armyType,
    canCreateAttackArmy,
    canCreateDefenseArmy,
    canInteractWithDefense,
    currentExplorersCount,
    maxExplorers,
    currentGuardsCount,
    resolvedMaxDefenseSlots,
    handleArmyTypeSelect,
    guardSlot,
    guardsBySlot,
    availableGuardSlots,
    defenseSlotInfoMessage,
    defenseSlotErrorMessage,
    handleGuardSlotSelect,
    structureCoordX,
    structureCoordY,
    freeDirections,
    selectedDirection,
    handleDirectionSelect,
    actionLabel,
    isLoading,
    isActionDisabled,
    handleCreate,
    blockedReason,
  };
};

/** Both surfaces submit through ArmyManager and its existing observed system calls. */
async function submitArmyCreation(
  manager: ArmyManager,
  account: Parameters<ArmyManager["createExplorerArmy"]>[0],
  troop: SelectedTroopCombo,
  count: number,
  target: { kind: "field"; direction: Direction } | { kind: "guard"; slot: number },
): Promise<void> {
  if (target.kind === "guard") {
    await manager.addTroopsToGuard(account, troop.type, troop.tier, count, target.slot);
    return;
  }
  await manager.createExplorerArmy(account, troop.type, troop.tier, count, target.direction);
  useUIStore.getState().bumpMilitaryMapVersion();
}
