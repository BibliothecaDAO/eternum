import { knownBalance } from "@/ui/utils/utils";
import {
  useCurrentArmiesTick,
  useCurrentBlockTimestamp,
  useCurrentDefaultTick,
} from "@/hooks/helpers/use-block-timestamp";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  configManager,
  divideByPrecision,
  formatTime,
  getBalance,
  getGuardSlotCooldownRemaining,
  getGuardsByStructure,
  getTroopResourceId,
  liveHomeArmies,
  ResourceManager,
  structureMapPosition,
  openSpawnDirections,
} from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import {
  BuildingType,
  BuildingTypeToString,
  Direction,
  DISPLAYED_SLOT_NUMBER_MAP,
  getBuildingFromResource,
  getNeighborHexes,
  GUARD_SLOT_NAMES,
  GuardSlot,
  ID,
  resources,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getStructureDefenseSlotLimit,
  getUnlockedGuardSlots,
  MAX_GUARD_SLOT_COUNT,
} from "../../utils/defense-slot-utils";
import { getGuardStaminaSnapshot } from "../../utils/guard-stamina";
import type { GuardSummary, SelectedTroopCombo, TroopSelectionOption } from "./types";
import { requireActiveGameClient } from "@/sync/active-game-client";

import { useBlitzRealmProvision } from "@/ui/modules/entity-details/hooks/use-blitz-realm-provision";
import {
  describeTroopTraining,
  resolveArmyCreationBlockedReason,
  resolveArmyTroopAvailability,
  resolveInitialTroop,
  resolveSpawnDirection,
  resolveTroopAvailabilityReason,
  type TroopSupply,
} from "./army-creation-policy";

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
    setup: { store },
  } = useGame();
  const mode = useGameModeConfig();
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
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const previousStructureIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialGuardSlot !== undefined) {
      setGuardSlot(initialGuardSlot);
    }
  }, [initialGuardSlot]);

  const structureComponent = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: activeStructureId,
  });
  const revision = useNativeRevision([
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "Guard",
    "ExplorerTroops",
  ]);
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
        // Troops this client cannot see can't be added to an army.
        const available =
          knownBalance(getBalance(activeStructureId, resourceId, currentDefaultTick, store).balance) ?? 0;
        const resource = resources.find((item) => item.id === resourceId);
        if (!resource) throw new Error(`Missing troop resource ${resourceId}`);

        return {
          tier,
          available,
          resourceTrait: resource.trait,
        };
      }),
    }));
  }, [activeStructureId, currentDefaultTick, store, revision]);

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
    () => (structureComponent ? getGuardsByStructure(structureComponent, store) : []),
    [structureComponent, store, revision],
  );

  const currentExplorersCount = useMemo(
    () => liveHomeArmies(store, activeStructureId, configManager.getActiveGameId()).length,
    [store, activeStructureId, revision, currentDefaultTick],
  );
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
        cooldownRemaining: getGuardSlotCooldownRemaining(guard, currentBlockTimestamp),
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
  }, [guardsData, availableGuardSlotSet, currentArmiesTick, currentBlockTimestamp]);

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
  const selectedSlotCooldown = selectedGuard?.cooldownRemaining ?? 0;
  // Spawn hexes surround the structure's map position: for a Frontier realm the day's site, as the contract spawns.
  const structurePosition = structureComponent ? structureMapPosition(store, structureComponent) : undefined;
  const structureCoordX = structurePosition?.x;
  const structureCoordY = structurePosition?.y;

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
      structureComponent
        ? openSpawnDirections(store, structureComponent, (hex) => {
            const tile = neighborTiles.find(
              (candidate) => candidate.hexCoords.col === hex.col && candidate.hexCoords.row === hex.row,
            );
            return tile ? Number(tile.occupierId) : undefined;
          })
        : [],
    [neighborTiles, store, structureComponent],
  );

  const isDefenseTroopLocked = !armyType && isSelectedSlotOccupied;

  useEffect(() => {
    if (previousStructureIdRef.current === activeStructureId) return;
    previousStructureIdRef.current = activeStructureId;
    const isTrainable = (troop: SelectedTroopCombo) =>
      mode.rules.isBuildingTypeAllowed(
        BuildingType[getBuildingFromResource(getTroopResourceId(troop.type, troop.tier))],
      );
    setSelectedTroopCombo(resolveInitialTroop(troopOptions, isTrainable) ?? DEFAULT_TROOP_COMBO);
  }, [activeStructureId, troopOptions, mode]);

  useEffect(() => {
    const next = resolveSpawnDirection(selectedDirection, freeDirections, direction);
    if (next !== selectedDirection) setSelectedDirection(next);
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

  const troopSupply = useMemo(
    () => readTroopSupply(store, activeStructureId, selectedTroopCombo, selectedAvailable, troopCapacityLimit),
    [store, activeStructureId, selectedTroopCombo, selectedAvailable, troopCapacityLimit, revision],
  );
  const troopAvailabilityReason = resolveTroopAvailabilityReason({
    capacityRemaining: capacityRemainingForSelector,
    available: selectedAvailable,
    supply: troopSupply,
  });

  const selectedGuardLabel =
    selectedGuardTier && selectedGuardCategory ? `${selectedGuardTier} ${selectedGuardCategory}` : null;
  const selectedGuardLabelUpper = selectedGuardLabel?.toUpperCase() ?? null;

  const defenseSlotErrorMessage = !armyType
    ? !isDefenseSlotCompatible && selectedGuardLabelUpper
      ? `Slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} currently contains ${selectedGuardLabelUpper}. Reinforce it with the same troop type and tier.`
      : selectedSlotCooldown > 0
        ? `Slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} was wiped out and is rebuilding for ${formatTime(selectedSlotCooldown)}.`
        : isDefenseSlotCreationBlocked
          ? "All defense slots are occupied. Select an occupied slot to reinforce or remove one to free space."
          : null
    : null;

  const defenseSlotInfoMessage =
    !armyType && isDefenseTroopLocked && selectedGuardLabel
      ? `Reinforcing ${selectedGuardLabel}. Other troop types are locked for this slot.`
      : null;

  const isDefenseActionDisabled =
    !armyType &&
    (!canInteractWithDefense || isDefenseSlotCreationBlocked || !isDefenseSlotCompatible || selectedSlotCooldown > 0);

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
    supply: troopSupply,
    troopCount,
    isLoading,
  });
  const isActionDisabled = blockedReason !== null;
  // The count controls already show the availability reason; the submit button names only a different one.
  const submitBlockedReason = blockedReason === troopAvailabilityReason ? null : blockedReason;

  const handleCreate = async () => {
    if (!activeStructureId || isActionDisabled || submittingRef.current) return;
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
      await submitArmyCreation(activeStructureId, selectedTroopCombo, troopCount, target);
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
    troopAvailabilityReason,
    submitBlockedReason,
    // With no troop on hand the availability reason already carries the training line.
    troopTrainingLine: troopAvailabilityReason ? null : describeTroopTraining(troopSupply),
  };
};

/** The selected troop's barracks output now, read the way the resource bar reads production. */
function readTroopSupply(
  store: ReturnType<typeof useGame>["setup"]["store"],
  structureId: ID,
  troop: SelectedTroopCombo,
  available: number,
  fullArmy: number | null,
): TroopSupply {
  const resourceId = getTroopResourceId(troop.type, troop.tier);
  const name = BuildingTypeToString[getBuildingFromResource(resourceId)];
  const manager = new ResourceManager(store, structureId);
  const production = manager.isActive(resourceId) ? manager.current(resourceId)?.production : undefined;
  const perSecond = production ? divideByPrecision(Number(production.production_rate), false) : 0;
  const secondsToFullArmy = perSecond > 0 && fullArmy !== null ? Math.max(0, (fullArmy - available) / perSecond) : null;
  return { name, perHour: Math.floor(perSecond * 3600), secondsToFullArmy };
}

/** Both surfaces submit through ArmyManager and its existing observed system calls. */
async function submitArmyCreation(
  structureId: ID,
  troop: SelectedTroopCombo,
  count: number,
  target: { kind: "field"; direction: Direction } | { kind: "guard"; slot: number },
): Promise<void> {
  const { actions } = requireActiveGameClient();
  const troops = { structureId, troopType: troop.type, troopTier: troop.tier, troopCount: count };
  if (target.kind === "guard") {
    await actions.addTroopsToGuard({ ...troops, slot: target.slot });
    return;
  }
  await actions.createExplorerArmy({ ...troops, spawnDirection: target.direction });
  useUIStore.getState().bumpMilitaryMapVersion();
}
