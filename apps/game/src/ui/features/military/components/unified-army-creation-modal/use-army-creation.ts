import { getGameModeId } from "@/config/game-modes";
import { NEW_ARMY, startsOn } from "@/ui/design-system/kit/words";
import { musterStamina } from "@bibliothecadao/eternum/troop-stamina";
import { useCurrentBlockTimestamp, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  canPayTroopRaise,
  configManager,
  divideByPrecision,
  getGuardSlotCooldownRemaining,
  getGuardsByStructure,
  getTroopResourceId,
  readTroopRaiseCost,
  ResourceManager,
} from "@bibliothecadao/eternum";
import type { GameModeConfig } from "@/config/game-modes";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import {
  BuildingType,
  buildingName,
  Direction,
  DISPLAYED_SLOT_NUMBER_MAP,
  getBuildingFromResource,
  ID,
  ResourcesIds,
  StructureType,
  TickIds,
  TroopTier,
  TroopType,
  formatAmount,
  formatWait,
} from "@bibliothecadao/types";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getStructureDefenseSlotLimit,
  getUnlockedGuardSlots,
  MAX_GUARD_SLOT_COUNT,
} from "../../utils/defense-slot-utils";
import { getGuardStaminaSnapshot } from "../../utils/guard-stamina";
import type { GuardSummary, SelectedTroopCombo, TroopSelectionOption, TroopStack } from "./types";
import { requireActiveGameClient } from "@/sync/active-game-client";

import { useBlitzRealmProvision } from "@/ui/modules/entity-details/hooks/use-blitz-realm-provision";
import {
  describeTroopSource,
  troopRaiseLine,
  resolveArmyCreationBlockedReason,
  resolveArmyTroopAvailability,
  resolveInitialTroop,
  resolveSpawnDirection,
  resolveTroopAvailabilityReason,
  type TroopSupply,
} from "./army-creation-policy";
import {
  fieldArmyTroops,
  formatTroopTypeLabel,
  hasFreeFieldArmySlot,
  heldTroops,
  readFieldArmyRoom,
} from "./field-army-room";
import { useDeployRing } from "./use-deploy-ring";

interface ArmyCreationOptions {
  /** The structure raising the army; undefined while the player has none to raise from. */
  structureId: ID | undefined;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  /** The troop stack an order named; the form opens on that troop at that count, within what can be raised. */
  initialTroops?: TroopStack;
  fixedContext?: boolean;
  onSubmit?: () => void;
}

const TROOP_TYPES: TroopType[] = [TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin];
const TROOP_TIERS: TroopTier[] = [TroopTier.T1, TroopTier.T2, TroopTier.T3];

export const useArmyCreation = ({
  structureId: activeStructureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
  initialGuardSlot,
  initialTroops,
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
  const [troopCount, setTroopCount] = useState(initialTroops?.count ?? 0);
  const [guardSlot, setGuardSlot] = useState(initialGuardSlot ?? 0);
  const [armyType, setArmyType] = useState(isExplorer);
  const currentDefaultTick = useCurrentDefaultTick();
  const currentBlockTimestamp = useCurrentBlockTimestamp();

  useEffect(() => {
    if (initialGuardSlot !== undefined) {
      setGuardSlot(initialGuardSlot);
    }
  }, [initialGuardSlot]);

  const structureComponent = useNativeRow(
    "Structure",
    activeStructureId === undefined
      ? undefined
      : { game_id: configManager.getActiveGameId(), entity_id: activeStructureId },
  );
  const revision = useNativeRevision([
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "Guard",
    "ExplorerTroops",
  ]);
  const provision = useBlitzRealmProvision(activeStructureId ?? null);

  const troopOptions = useMemo<TroopSelectionOption[]>(() => {
    if (activeStructureId === undefined) {
      return TROOP_TYPES.map((type) => ({
        type,
        label: formatTroopTypeLabel(type),
        tiers: TROOP_TIERS.map((tier) => ({ tier, available: 0, resourceId: getTroopResourceId(type, tier) })),
      }));
    }

    return TROOP_TYPES.map((type) => ({
      type,
      label: formatTroopTypeLabel(type),
      tiers: TROOP_TIERS.map((tier) => {
        const resourceId = getTroopResourceId(type, tier);
        return { tier, available: heldTroops(store, activeStructureId, resourceId, currentDefaultTick), resourceId };
      }),
    }));
  }, [activeStructureId, currentDefaultTick, store, revision]);

  // The form opens on a troop this structure can deploy, and on a new structure's when the structure changes; the
  // game's own cost and capacity reads never see a troop the game does not raise.
  const openingTroop = () => resolveOpeningTroop(troopOptions, mode);
  // An order that named a troop opens on it; otherwise the form's own opening troop.
  const [selectedTroopCombo, setSelectedTroopCombo] = useState<SelectedTroopCombo>(() =>
    initialTroops ? { type: initialTroops.type, tier: initialTroops.tier } : openingTroop(),
  );
  const [troopStructureId, setTroopStructureId] = useState(activeStructureId);
  if (troopStructureId !== activeStructureId) {
    setTroopStructureId(activeStructureId);
    setSelectedTroopCombo(openingTroop());
  }

  // The selected troop's field army room: the same troops, slots and cap the attack forecast's advice reads.
  const fieldRoom = useMemo(
    () =>
      structureComponent ? readFieldArmyRoom(store, structureComponent, selectedTroopCombo, currentDefaultTick) : null,
    [store, structureComponent, selectedTroopCombo, revision, currentDefaultTick],
  );
  const structureBase = structureComponent?.base;
  const structureCategory = structureBase?.category as StructureType | undefined;
  const structureLevel = structureBase?.level ?? null;
  const troopCapacityLimit = fieldRoom?.cap ?? null;
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

  const currentExplorersCount = fieldRoom?.armies ?? 0;
  const currentGuardsCount = guardsData?.filter(
    (guard) => guard.troops?.count && guard.troops.count > 0n && availableGuardSlotSet.has(Number(guard.slot)),
  ).length;
  // Undefined for a structure this client cannot see: no attack army can be created from it.
  const maxExplorers = fieldRoom?.maxArmies;

  const canCreateAttackArmy = fieldRoom !== null && hasFreeFieldArmySlot(fieldRoom);
  const canCreateDefenseArmy = currentGuardsCount !== undefined && currentGuardsCount < resolvedMaxDefenseSlots;
  const hasDefenseArmies = currentGuardsCount !== undefined && currentGuardsCount > 0;
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
      const staminaSnapshot = getGuardStaminaSnapshot(troops, currentDefaultTick);
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
  }, [guardsData, availableGuardSlotSet, currentDefaultTick, currentBlockTimestamp]);

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
  const { center: deployCenter, ring: deployRing } = useDeployRing(structureComponent);

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
    setTroopCount(initialTroops?.count ?? 0);
    setGuardSlot(initialGuardSlot ?? 0);
  }, [activeStructureId, initialGuardSlot, initialTroops?.count]);

  const freeDirections = useMemo(
    () => deployRing.filter((tile) => tile.open).map((tile) => tile.direction),
    [deployRing],
  );

  const isDefenseTroopLocked = !armyType && isSelectedSlotOccupied;

  useEffect(() => {
    const next = resolveSpawnDirection(selectedDirection, freeDirections, direction);
    if (next !== selectedDirection) setSelectedDirection(next);
  }, [freeDirections, selectedDirection, direction]);

  useEffect(() => {
    // A structure without defense slots shows Attack. A full field army cap never moves the window off Attack: right
    // after raising an army the player stays with it, not on another tab's notice.
    if (fixedContext) return;
    if (!armyType && !canInteractWithDefense && canCreateAttackArmy) setArmyType(true);
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
  const maxAffordable = armyType
    ? fieldRoom === null
      ? 0
      : fieldArmyTroops(fieldRoom)
    : capacityRemainingForSelector === null
      ? 0
      : resolveArmyTroopAvailability(selectedAvailable, capacityRemainingForSelector);

  // The count stays within what can be raised, once that is known: a count an order named is not lost to the zero the
  // maximum reads while its facts load.
  const maxKnown = armyType ? fieldRoom !== null : capacityRemainingForSelector !== null;
  useEffect(() => {
    if (maxKnown) setTroopCount((current) => Math.max(0, Math.min(current, maxAffordable)));
  }, [maxAffordable, maxKnown]);

  const troopSupply = useMemo(
    () =>
      readTroopSupply(
        store,
        activeStructureId,
        selectedTroopCombo,
        selectedAvailable,
        troopCapacityLimit,
        currentDefaultTick,
      ),
    [store, activeStructureId, selectedTroopCombo, selectedAvailable, troopCapacityLimit, revision, currentDefaultTick],
  );
  const raiseCost = useMemo(
    () =>
      activeStructureId === undefined
        ? undefined
        : readTroopRaiseCost(
            store,
            configManager.getActiveGameId(),
            activeStructureId,
            getTroopResourceId(selectedTroopCombo.type, selectedTroopCombo.tier),
            troopCount,
            currentDefaultTick,
          ),
    [store, activeStructureId, selectedTroopCombo, troopCount, currentDefaultTick, revision],
  );
  const troopAvailabilityReason = resolveTroopAvailabilityReason({
    capacityRemaining: capacityRemainingForSelector,
    available: selectedAvailable,
    supply: troopSupply,
  });

  const selectedGuardLabel =
    selectedGuardTier && selectedGuardCategory ? `${selectedGuardTier} ${selectedGuardCategory}` : null;

  const defenseSlotErrorMessage = !armyType
    ? !isDefenseSlotCompatible && selectedGuardLabel
      ? `Slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} currently contains ${selectedGuardLabel}. Reinforce it with the same troop type and tier.`
      : selectedSlotCooldown > 0
        ? `Slot ${DISPLAYED_SLOT_NUMBER_MAP[guardSlot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} was wiped out and is rebuilding for ${formatWait(selectedSlotCooldown)}.`
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
    canPayRaise: canPayTroopRaise(raiseCost),
    isLoading,
  });
  const isActionDisabled = blockedReason !== null;

  const handleCreate = async () => {
    if (activeStructureId === undefined || isActionDisabled || submittingRef.current) return;
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
    deployCenter,
    deployRing,
    selectedDirection,
    handleDirectionSelect,
    isLoading,
    isActionDisabled,
    handleCreate,
    troopAvailabilityReason,
    blockedReason,
    // With none on hand, where they come from: the empty state's next step.
    troopSourceLine:
      selectedAvailable < 1 ? describeTroopSource(troopSupply.name, readTroopRecipe(store, selectedTroopCombo)) : null,
    raiseLine: troopRaiseLine(raiseCost),
    // A field army's starting stamina, before it is raised (live-qa-night-2 B-2); a guard has no line.
    startLine: armyType ? fieldArmyStartLine(selectedTroopCombo, currentBlockTimestamp) : null,
  };
};

/**
 * The stamina a field army starts on, through the core's one rule for a new army (musterStamina). The Military window
 * raises armies in games without army slots (Blitz, Eternum); Frontier deploys through its own sheet, by slot.
 */
const fieldArmyStartLine = (troop: SelectedTroopCombo, timestamp: number): string => {
  const bar = musterStamina(
    null,
    { category: troop.type, tier: troop.tier },
    timestamp,
    configManager.getTroopStaminaRules(),
    0,
    configManager.getTick(TickIds.Armies),
  );
  return startsOn(NEW_ARMY, `${formatAmount(bar.amount)}/${formatAmount(bar.max)}`, bar.amount === bar.max);
};

/**
 * The troop the form opens on: one the structure holds, else the first this mode lets a realm train. A mode that
 * trains no troop at all is a config hole, and loud.
 */
function resolveOpeningTroop(options: TroopSelectionOption[], mode: GameModeConfig): SelectedTroopCombo {
  const troop = resolveInitialTroop(options, ({ type, tier }) =>
    mode.rules.isBuildingTypeAllowed(BuildingType[getBuildingFromResource(getTroopResourceId(type, tier))]),
  );
  if (!troop) throw new Error(`${mode.displayName} trains no troop an army could deploy`);
  return troop;
}

/** The selected troop's barracks output now, read the way the resource bar reads production. */
/** What the structure trains of this troop; with no structure nothing is read and nothing trains. */
/**
 * What a troop's barracks trains it from, per troop: its resource recipe (complex inputs, the arena games' only path),
 * else its labor-paid one (simple inputs). Deployment charges are a separate cost and never part of this.
 */
function readTroopRecipe(store: ReturnType<typeof useGame>["setup"]["store"], troop: SelectedTroopCombo) {
  const recipe = store.get("ProductionRecipe", {
    game_id: configManager.getActiveGameId(),
    resource_type: getTroopResourceId(troop.type, troop.tier),
  });
  if (!recipe) return [];
  const [inputs, output] =
    recipe.complex_output > 0n
      ? [recipe.complex_inputs, recipe.complex_output]
      : [recipe.simple_inputs, recipe.simple_output];
  if (output === 0n) return [];
  return inputs.map((input) => ({
    resource: input.resource_type as ResourcesIds,
    perTroop: Number(input.amount) / Number(output),
  }));
}

function readTroopSupply(
  store: ReturnType<typeof useGame>["setup"]["store"],
  structureId: ID | undefined,
  troop: SelectedTroopCombo,
  available: number,
  fullArmy: number | null,
  timestamp: number,
): TroopSupply {
  const resourceId = getTroopResourceId(troop.type, troop.tier);
  const name = buildingName(getBuildingFromResource(resourceId), getGameModeId() === "frontier");
  if (structureId === undefined) return { name, perHour: 0, secondsToFullArmy: null };
  const manager = new ResourceManager(store, structureId);
  const production = manager.isActive(resourceId) ? manager.current(resourceId) : undefined;
  const perSecond = production
    ? ResourceManager.calculateResourceProductionData(resourceId, production, timestamp).productionPerSecond
    : 0;
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
