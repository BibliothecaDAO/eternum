import { sqlApi } from "@/services/api";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import {
  ArmyManager,
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getIsBlitz,
  getStructureName,
  getTroopResourceId,
} from "@bibliothecadao/eternum";
import {
  useDojo,
  useExplorersByStructure,
  usePlayerOwnedRealmsInfo,
  usePlayerOwnedVillagesInfo,
} from "@bibliothecadao/react";
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
import { getComponentValue } from "@dojoengine/recs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getStructureDefenseSlotLimit,
  getUnlockedGuardSlots,
  MAX_GUARD_SLOT_COUNT,
} from "../../utils/defense-slot-utils";
import { ActionFooter } from "./action-footer";
import { ArmyTypeToggle } from "./army-type-toggle";
import { DefenseSlotSelection } from "./defense-slot-selection";
import { DirectionSelection } from "./direction-selection";
import { TroopCountSelector } from "./troop-count-selector";
import { TroopSelectionGrid } from "./troop-selection-grid";
import type { GuardSummary, SelectedTroopCombo, TroopSelectionOption } from "./types";

interface UnifiedArmyCreationModalProps {
  structureId: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
  initialGuardSlot?: number;
  onClose?: () => void;
}

const TROOP_TYPES: TroopType[] = [TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin];
const TROOP_TIERS: TroopTier[] = [TroopTier.T1, TroopTier.T2, TroopTier.T3];
const DEFAULT_TROOP_COMBO: SelectedTroopCombo = {
  type: TroopType.Crossbowman,
  tier: TroopTier.T1,
};

const formatTroopTypeLabel = (type: TroopType) => (type === TroopType.Crossbowman ? "CROSSBOW" : type);

export const UnifiedArmyCreationModal = ({
  structureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
  initialGuardSlot,
  onClose,
}: UnifiedArmyCreationModalProps) => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();
  const queryClient = useQueryClient();

  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const isBlitz = getIsBlitz();

  const playerStructures = useMemo(() => {
    return [...playerRealms, ...playerVillages]
      .filter((realm) => {
        const maxAttack = realm.structure.base.troop_max_explorer_count || 0;
        const maxDefense = realm.structure.base.troop_max_guard_count || 0;
        return maxAttack > 0 || maxDefense > 0;
      })
      .sort((a, b) => {
        const nameA = getStructureName(a.structure, isBlitz).name;
        const nameB = getStructureName(b.structure, isBlitz).name;
        return nameA.localeCompare(nameB);
      });
  }, [playerRealms, playerVillages, isBlitz]);

  const [isLoading, setIsLoading] = useState(false);
  const [freeDirections, setFreeDirections] = useState<Direction[]>([]);
  const [isLoadingDirections, setIsLoadingDirections] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(
    direction !== undefined ? direction : null,
  );
  const [loadedDirectionsStructureId, setLoadedDirectionsStructureId] = useState<number | null>(null);
  const [selectedTroopCombo, setSelectedTroopCombo] = useState<SelectedTroopCombo>(() => ({
    ...DEFAULT_TROOP_COMBO,
  }));
  const [troopCount, setTroopCount] = useState(0);
  const [guardSlot, setGuardSlot] = useState(initialGuardSlot ?? 0);
  const [armyType, setArmyType] = useState(isExplorer);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const previousStructureIdRef = useRef<number | null>(null);

  const troopMaxSizeRaw = configManager.getTroopConfig().troop_max_size;
  const parsedTroopCap = Number(troopMaxSizeRaw ?? 0);
  const hasTroopCap = Number.isFinite(parsedTroopCap) && parsedTroopCap > 0;
  const troopCapacityLimit = hasTroopCap ? parsedTroopCap : null;

  useEffect(() => {
    if (initialGuardSlot !== undefined) {
      setGuardSlot(initialGuardSlot);
    }
  }, [initialGuardSlot]);

  const activeStructureId = structureId ?? playerStructures[0]?.entityId ?? 0;

  const structureComponent = useMemo(() => {
    if (!activeStructureId) return null;
    return getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(activeStructureId)]));
  }, [components, activeStructureId]);

  const activeStructureInfo = useMemo(
    () => playerStructures.find((realm) => realm.entityId === activeStructureId),
    [playerStructures, activeStructureId],
  );

  const structureBase = activeStructureInfo?.structure.base ?? structureComponent?.base;
  const structureName = activeStructureInfo
    ? getStructureName(activeStructureInfo.structure, isBlitz).name
    : structureComponent
      ? getStructureName(structureComponent, isBlitz).name
      : undefined;

  const structureCategory = structureBase?.category as StructureType | undefined;
  const structureLevel = structureBase?.level ?? null;
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

  const { data: guardsData } = useQuery({
    queryKey: ["guards", String(activeStructureId)],
    queryFn: async () => {
      if (!activeStructureId) return [];
      const guards = await sqlApi.fetchGuardsByStructure(activeStructureId);
      return guards.filter((guard) => guard.troops?.count && guard.troops.count > 0n);
    },
    staleTime: 10000,
    enabled: activeStructureId > 0,
  });

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

      map.set(numericSlot, {
        slot: guard.slot,
        troops: troops
          ? {
              category: troops.category as TroopType | undefined,
              tier: troops.tier as TroopTier | undefined,
              count,
            }
          : null,
      });
    });
    return map;
  }, [guardsData, availableGuardSlotSet]);

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
  const isSelectedSlotOccupied = Boolean(selectedGuard);
  const isDefenseSlotCompatible =
    !selectedGuard ||
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
    setLoadedDirectionsStructureId(null);
    setFreeDirections([]);
    setSelectedDirection(direction !== undefined ? direction : null);
    setTroopCount(0);
    setGuardSlot(initialGuardSlot ?? 0);
  }, [activeStructureId, direction, initialGuardSlot]);

  useEffect(() => {
    if (structureCoordX === undefined || structureCoordY === undefined || !activeStructureId) {
      return;
    }

    if (loadedDirectionsStructureId === activeStructureId) {
      return;
    }

    let isCancelled = false;

    const loadDirections = async () => {
      setIsLoadingDirections(true);
      try {
        const coords = getNeighborHexes(structureCoordX, structureCoordY);
        const tiles = await sqlApi.fetchTilesByCoords(coords.map((coord) => ({ col: coord.col, row: coord.row })));
        if (isCancelled) {
          return;
        }
        const freeTiles = tiles.filter((tile) => tile.occupier_id === 0);
        const directions = freeTiles
          .map((tile) =>
            getDirectionBetweenAdjacentHexes(
              { col: structureCoordX, row: structureCoordY },
              { col: tile.col, row: tile.row },
            ),
          )
          .filter((dir): dir is Direction => dir !== null);

        if (isCancelled) {
          return;
        }

        setFreeDirections(directions);
        setLoadedDirectionsStructureId(activeStructureId);
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to load available directions:", error);
          setFreeDirections([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDirections(false);
        }
      }
    };

    setFreeDirections([]);
    loadDirections();

    return () => {
      isCancelled = true;
    };
  }, [structureCoordX, structureCoordY, activeStructureId, loadedDirectionsStructureId]);

  const isDefenseTroopLocked = !armyType && isSelectedSlotOccupied;

  const armyManager = useMemo(() => {
    if (!activeStructureId) return null;
    return new ArmyManager(systemCalls, activeStructureId as ID);
  }, [activeStructureId, components, systemCalls]);

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
        const fallbackSlot = [...occupiedSlots].sort((a, b) => a - b)[0];
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
      } else {
        if (!isDefenseSlotCompatible) {
          throw new Error("Selected defense slot requires matching troop type and tier");
        }
        if (isDefenseSlotCreationBlocked) {
          throw new Error("No available defense slot for new troops");
        }
        if (!availableGuardSlotSet.has(guardSlot)) {
          throw new Error("Selected defense slot is locked for this structure level");
        }
        await armyManager.addTroopsToGuard(
          account,
          selectedTroopCombo.type,
          selectedTroopCombo.tier,
          troopCount,
          guardSlot,
        );
        if (activeStructureId > 0) {
          await queryClient.invalidateQueries({
            queryKey: ["guards", String(activeStructureId)],
            exact: true,
            refetchType: "active",
          });
        }
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
    ? "CREATE ATTACK ARMY"
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

  const modalBaseTitle = armyType ? "Create Attack Army" : "Create Defense Army";
  const modalTitle = structureName ? `${structureName} - ${modalBaseTitle}` : modalBaseTitle;

  return (
    <SecondaryPopup width="800" name="unified-army-creation-modal" containerClassName="absolute left-0 top-0">
      <SecondaryPopup.Head onClose={onClose}>{modalTitle}</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="auto">
        <div className="p-3">
          <div className="flex gap-2">
            <div className="flex flex-col w-[420px]">
              <TroopSelectionGrid
                options={troopOptions}
                selected={selectedTroopCombo}
                isDefenseTroopLocked={isDefenseTroopLocked}
                selectedGuardCategory={selectedGuardCategory}
                selectedGuardTier={selectedGuardTier}
                onSelect={handleTroopSelect}
              />
              <TroopCountSelector
                troopCount={troopCount}
                maxAffordable={maxAffordable}
                onChange={handleTroopCountChange}
                capacityRemaining={capacityRemainingForSelector}
                troopMaxSize={troopCapacityLimit ?? undefined}
              />
            </div>

            <div className="flex flex-col space-y-1.5 w-[340px]">
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

              <div className="flex-1 min-h-[140px]">
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

                {armyType && (
                  <DirectionSelection
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    isLoading={isLoadingDirections}
                    onSelect={handleDirectionSelect}
                  />
                )}
              </div>

              <ActionFooter
                armyType={armyType}
                label={actionLabel}
                isLoading={isLoading}
                isDisabled={isActionDisabled}
                onSubmit={handleCreate}
              />
            </div>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
