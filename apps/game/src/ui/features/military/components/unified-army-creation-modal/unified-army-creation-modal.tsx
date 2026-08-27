import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useOwnedMilitaryStructureInfos } from "@/hooks/helpers/use-owned-structure-info";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import {
  ArmyManager,
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getGuardsByStructure,
  getTroopResourceId,
} from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getStructureDefenseSlotLimit,
  getUnlockedGuardSlots,
  MAX_GUARD_SLOT_COUNT,
} from "../../utils/defense-slot-utils";
import { getGuardStaminaSnapshot } from "../../utils/guard-stamina";
import { ActionFooter } from "./action-footer";
import { ArmyTypeToggle } from "./army-type-toggle";
import { DefenseSlotSelection } from "./defense-slot-selection";
import { RealmHexDeployMap } from "./realm-hex-deploy-map";
import { TroopCountSelector } from "./troop-count-selector";
import { TroopSelectionGrid } from "./troop-selection-grid";
import type { GuardSummary, SelectedTroopCombo, TroopSelectionOption } from "./types";
import { gameEntityKey } from "@/dojo/game-scope";

interface UnifiedArmyCreationProps {
  structureId?: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  followSelectedStructure?: boolean;
}

type UnifiedArmyCreationBodyProps = UnifiedArmyCreationProps & {
  /**
   * Kept for call-site compatibility. The legacy popup chrome has been removed;
   * the parent Military modal provides the window shell.
   */
  embedded?: boolean;
  /**
   * When true, the troop count snaps to the current maxAffordable whenever
   * the troop combo, slot, or army type changes. Used by the Military modal
   * so the player can submit in one extra click (slot → ADD).
   */
  autoMaxOnContextChange?: boolean;
};

const TROOP_TYPES: TroopType[] = [TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin];
const TROOP_TIERS: TroopTier[] = [TroopTier.T1, TroopTier.T2, TroopTier.T3];
const DEFAULT_TROOP_COMBO: SelectedTroopCombo = {
  type: TroopType.Crossbowman,
  tier: TroopTier.T1,
};

const formatTroopTypeLabel = (type: TroopType) => (type === TroopType.Crossbowman ? "CROSSBOW" : type);

export const UnifiedArmyCreationBody = ({
  structureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
  initialGuardSlot,
  followSelectedStructure,
  embedded = true,
  autoMaxOnContextChange = false,
}: UnifiedArmyCreationBodyProps) => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();
  const mode = useGameModeConfig();
  const playerStructures = useOwnedMilitaryStructureInfos();
  const selectedStructureId = useUIStore((state) => state.structureEntityId);
  const sortedPlayerStructures = useMemo(
    () =>
      playerStructures.toSorted((a, b) => {
        const nameA = mode.structure.getName(a.structure).name;
        const nameB = mode.structure.getName(b.structure).name;
        return nameA.localeCompare(nameB);
      }),
    [playerStructures, mode],
  );

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
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const previousStructureIdRef = useRef<number | null>(null);

  // troopCapacityLimit computed below after structureLevel is resolved

  useEffect(() => {
    if (initialGuardSlot !== undefined) {
      setGuardSlot(initialGuardSlot);
    }
  }, [initialGuardSlot]);

  const resolveNumericId = (value: unknown): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const resolvedSelectedStructureId = resolveNumericId(selectedStructureId);
  const resolvedStructureIdProp = resolveNumericId(structureId);
  const [shouldFollowSelection] = useState(() => {
    if (followSelectedStructure !== undefined) {
      return followSelectedStructure;
    }

    if (
      resolvedStructureIdProp === null ||
      resolvedSelectedStructureId === null ||
      resolvedStructureIdProp <= UNDEFINED_STRUCTURE_ENTITY_ID ||
      resolvedSelectedStructureId <= UNDEFINED_STRUCTURE_ENTITY_ID
    ) {
      return false;
    }

    return resolvedStructureIdProp === resolvedSelectedStructureId;
  });

  const activeStructureId = useMemo(() => {
    if (
      shouldFollowSelection &&
      resolvedSelectedStructureId &&
      resolvedSelectedStructureId > UNDEFINED_STRUCTURE_ENTITY_ID
    ) {
      return resolvedSelectedStructureId;
    }

    if (resolvedStructureIdProp && resolvedStructureIdProp > UNDEFINED_STRUCTURE_ENTITY_ID) {
      return resolvedStructureIdProp;
    }

    if (resolvedSelectedStructureId && resolvedSelectedStructureId > UNDEFINED_STRUCTURE_ENTITY_ID) {
      return resolvedSelectedStructureId;
    }

    return sortedPlayerStructures[0]?.entityId ?? 0;
  }, [shouldFollowSelection, resolvedSelectedStructureId, resolvedStructureIdProp, sortedPlayerStructures]);

  const structureComponent = useComponentValue(components.Structure, gameEntityKey([BigInt(activeStructureId || 0)]));

  const activeStructureInfo = useMemo(
    () => sortedPlayerStructures.find((realm) => realm.entityId === activeStructureId),
    [sortedPlayerStructures, activeStructureId],
  );

  const structureBase = activeStructureInfo?.structure.base ?? structureComponent?.base;
  const structureCategory = structureBase?.category as StructureType | undefined;
  const structureLevel = structureBase?.level ?? null;
  const troopCapacityLimit =
    configManager.getMaxArmySize(structureLevel ?? 0, selectedTroopCombo.tier as TroopTier) || null;
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

  const explorers = useExplorersByStructure({
    structureEntityId: activeStructureId || 0,
  });

  const guardsData = useMemo(
    () => (structureComponent ? getGuardsByStructure(structureComponent) : []),
    [structureComponent],
  );

  const currentExplorersCount = explorers.length;
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
    if (armyType) {
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
  }, [armyType, availableGuardSlots, guardSlot]);

  useEffect(() => {
    setArmyType(isExplorer);
  }, [isExplorer]);

  useEffect(() => {
    setSelectedDirection(direction !== undefined ? direction : null);
    setTroopCount(0);
    setGuardSlot(initialGuardSlot ?? 0);
  }, [activeStructureId, direction, initialGuardSlot]);

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
    const activeId = activeStructureId ?? 0;
    const previousStructureId = previousStructureIdRef.current;
    const structureChanged = previousStructureId !== activeId;
    previousStructureIdRef.current = activeId;

    if (!activeId) {
      setSelectedTroopCombo((previous) => {
        if (previous.type === DEFAULT_TROOP_COMBO.type && previous.tier === DEFAULT_TROOP_COMBO.tier) {
          return previous;
        }
        return { ...DEFAULT_TROOP_COMBO };
      });
      return;
    }

    let firstTroopWithBalance: SelectedTroopCombo | null = null;

    for (const type of TROOP_TYPES) {
      for (const tier of TROOP_TIERS) {
        const resourceId = getTroopResourceId(type, tier);
        const balance = getBalance(activeId, resourceId, currentDefaultTick, components).balance;
        const available = Number(divideByPrecision(balance) || 0);

        if (available > 0) {
          firstTroopWithBalance = { type, tier };
          break;
        }
      }
      if (firstTroopWithBalance) {
        break;
      }
    }

    setSelectedTroopCombo((previous) => {
      if (!structureChanged) {
        const previousResourceId = getTroopResourceId(previous.type, previous.tier);
        const previousBalance = getBalance(activeId, previousResourceId, currentDefaultTick, components).balance;
        const previousAvailable = Number(divideByPrecision(previousBalance) || 0);

        if (previousAvailable > 0) {
          return previous;
        }
      }

      if (firstTroopWithBalance) {
        if (previous.type === firstTroopWithBalance.type && previous.tier === firstTroopWithBalance.tier) {
          return previous;
        }
        return firstTroopWithBalance;
      }

      if (previous.type === DEFAULT_TROOP_COMBO.type && previous.tier === DEFAULT_TROOP_COMBO.tier) {
        return previous;
      }

      return { ...DEFAULT_TROOP_COMBO };
    });
  }, [activeStructureId, components, currentDefaultTick]);

  useEffect(() => {
    if (freeDirections.length > 0 && selectedDirection === null && direction === undefined) {
      setSelectedDirection(freeDirections[0]);
    }
  }, [freeDirections, selectedDirection, direction]);

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
  }, [armyType, guardsData, guardSlot, canCreateDefenseArmy, availableGuardSlotSet]);

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
        // Tile occupancy changed — kick the deploy map to re-fetch.
        useUIStore.getState().bumpMilitaryMapVersion();
      } else {
        if (!isDefenseSlotCompatible) {
          throw new Error("Selected defense slot requires matching troop type and tier");
        }
        if (isDefenseSlotCreationBlocked) {
          throw new Error("No available defense slot for new troops");
        }
        // Use effectiveGuardSlot which falls back to first available if current selection is invalid
        const slotToUse = availableGuardSlotSet.has(guardSlot) ? guardSlot : (availableGuardSlots[0] ?? guardSlot);
        if (!availableGuardSlotSet.has(slotToUse)) {
          throw new Error("Selected defense slot is locked for this structure level");
        }
        await armyManager.addTroopsToGuard(
          account,
          selectedTroopCombo.type,
          selectedTroopCombo.tier,
          troopCount,
          slotToUse,
        );
      }
    } catch (error) {
      console.error("Failed to create army:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
        const available = Number(divideByPrecision(balance) || 0);
        const resource = resources.find((item) => item.id === resourceId);

        return {
          tier,
          available,
          resourceTrait: resource?.trait ?? "",
        };
      }),
    }));
  }, [activeStructureId, currentDefaultTick, components]);

  const maxAffordable = useMemo(() => {
    if (!activeStructureId) return 0;
    const resourceId = getTroopResourceId(selectedTroopCombo.type, selectedTroopCombo.tier);
    const balance = getBalance(activeStructureId, resourceId, currentDefaultTick, components).balance;
    const available = Number(divideByPrecision(balance) || 0);
    const capacityLimit =
      capacityRemainingForSelector !== null ? capacityRemainingForSelector : Number.POSITIVE_INFINITY;
    return Math.max(0, Math.min(available, capacityLimit));
  }, [
    activeStructureId,
    selectedTroopCombo.type,
    selectedTroopCombo.tier,
    currentDefaultTick,
    components,
    capacityRemainingForSelector,
  ]);

  useEffect(() => {
    setTroopCount((current) => Math.max(0, Math.min(current, maxAffordable)));
  }, [maxAffordable]);

  // Smart-default mode: snap troopCount to maxAffordable whenever the player
  // changes the action context (slot, army type, troop pick). One click to
  // open the action, one click to submit — no manual MAX press needed.
  useEffect(() => {
    if (!autoMaxOnContextChange) return;
    setTroopCount(maxAffordable);
  }, [autoMaxOnContextChange, maxAffordable, armyType, guardSlot, selectedTroopCombo.type, selectedTroopCombo.tier]);

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

  const isActionDisabled =
    activeStructureId <= 0 ||
    troopCount <= 0 ||
    troopCount > maxAffordable ||
    isLoading ||
    (armyType && (selectedDirection === null || !canCreateAttackArmy)) ||
    isDefenseActionDisabled;

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

  const leftColumnClass = "flex flex-1 min-w-0 flex-col";
  const rightColumnClass = "flex flex-1 min-w-0 flex-col";

  return (
    <div className="p-3">
      <div className="flex items-stretch gap-3">
        <div className={leftColumnClass}>
          <div className="flex flex-1 flex-col rounded-xl border border-gold/25 bg-black/25 p-2 gap-2">
            <TroopSelectionGrid
              options={troopOptions}
              selected={selectedTroopCombo}
              isDefenseTroopLocked={isDefenseTroopLocked}
              selectedGuardCategory={selectedGuardCategory}
              selectedGuardTier={selectedGuardTier}
              onSelect={handleTroopSelect}
              bare
            />
            <div className="border-t border-gold/15" />
            <TroopCountSelector
              troopCount={troopCount}
              maxAffordable={maxAffordable}
              onChange={handleTroopCountChange}
              capacityRemaining={capacityRemainingForSelector}
              troopMaxSize={troopCapacityLimit ?? undefined}
              embedded
            />
            {troopCapacityLimit !== null && troopCapacityLimit !== undefined && (
              <>
                <div className="border-t border-gold/15" />
                <div className="flex items-center justify-between px-1 py-0.5 text-[11px]">
                  <span className="uppercase tracking-wider text-gold/55">Max troops</span>
                  <span className="font-semibold tabular-nums text-gold">{troopCapacityLimit.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={rightColumnClass}>
          <div className="flex flex-1 flex-col rounded-xl border border-gold/25 bg-black/25 p-2 gap-2">
            <ArmyTypeToggle
              armyType={armyType}
              canCreateAttackArmy={canCreateAttackArmy}
              canCreateDefenseArmy={canCreateDefenseArmy}
              canInteractWithDefense={canInteractWithDefense}
              currentExplorersCount={currentExplorersCount}
              maxExplorers={maxExplorers}
              currentGuardsCount={currentGuardsCount}
              maxGuards={resolvedMaxDefenseSlots}
              onSelect={handleArmyTypeSelect}
            />
            <div className="border-t border-gold/15" />
            <div className="flex-1 min-h-[140px] flex flex-col">
              {!armyType && (
                <DefenseSlotSelection
                  guardSlot={guardSlot}
                  maxDefenseSlots={resolvedMaxDefenseSlots}
                  guardsBySlot={guardsBySlot}
                  availableSlots={availableGuardSlots}
                  selectedTroopCombo={selectedTroopCombo}
                  canCreateDefenseArmy={canCreateDefenseArmy}
                  defenseSlotInfoMessage={defenseSlotInfoMessage}
                  defenseSlotErrorMessage={defenseSlotErrorMessage}
                  onSelect={handleGuardSlotSelect}
                />
              )}
              {armyType && structureCoordX !== undefined && structureCoordY !== undefined && (
                <RealmHexDeployMap
                  centerCol={Number(structureCoordX)}
                  centerRow={Number(structureCoordY)}
                  availableDirections={freeDirections}
                  selectedDirection={selectedDirection}
                  isLoading={false}
                  onSelect={handleDirectionSelect}
                />
              )}
            </div>
          </div>
          <div className="mt-2">
            <ActionFooter
              armyType={armyType}
              label={actionLabel}
              isLoading={isLoading}
              isDisabled={isActionDisabled}
              onSubmit={handleCreate}
              embedded
            />
          </div>
        </div>
      </div>
    </div>
  );
};
