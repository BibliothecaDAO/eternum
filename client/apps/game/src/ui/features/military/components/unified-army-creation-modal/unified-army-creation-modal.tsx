import { sqlApi } from "@/services/api";
import { ModalContainer } from "@/ui/shared/components/modal-container";
import {
  ArmyManager,
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
  DEFENSE_NAMES,
  Direction,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  ID,
  resources,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActionFooter } from "./action-footer";
import { ArmyTypeToggle } from "./army-type-toggle";
import { DefenseSlotSelection } from "./defense-slot-selection";
import { DirectionSelection } from "./direction-selection";
import { StructureSelectionList } from "./structure-selection-list";
import { TroopCountSelector } from "./troop-count-selector";
import { TroopSelectionGrid } from "./troop-selection-grid";
import type { GuardSummary, SelectedTroopCombo, TroopSelectionOption } from "./types";

interface UnifiedArmyCreationModalProps {
  structureId: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
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

  const [selectedStructureId, setSelectedStructureId] = useState<number | null>(structureId ?? null);
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
  const [guardSlot, setGuardSlot] = useState(0);
  const [armyType, setArmyType] = useState(isExplorer);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const previousStructureIdRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedStructureId(structureId ?? null);
  }, [structureId]);

  const fallbackStructureId = playerStructures[0]?.entityId ?? structureId ?? 0;
  const activeStructureId = selectedStructureId ?? fallbackStructureId;

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
  const currentGuardsCount = guardsData?.length || 0;
  const maxExplorers = structureBase?.troop_max_explorer_count || 0;
  const resolvedMaxDefenseSlots = structureBase?.troop_max_guard_count || maxDefenseSlots;

  const canCreateAttackArmy = currentExplorersCount < maxExplorers;
  const canCreateDefenseArmy = currentGuardsCount < resolvedMaxDefenseSlots;
  const hasDefenseArmies = currentGuardsCount > 0;
  const canInteractWithDefense = canCreateDefenseArmy || hasDefenseArmies;

  const guardsBySlot = useMemo(() => {
    const map = new Map<number, GuardSummary>();
    (guardsData ?? []).forEach((guard) => {
      const troops = guard.troops;
      const count =
        troops && troops.count !== undefined
          ? divideByPrecision(Number(troops.count))
          : undefined;

      map.set(Number(guard.slot), {
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
  }, [guardsData]);

  const selectedGuard = guardsBySlot.get(guardSlot);
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
    setLoadedDirectionsStructureId(null);
    setFreeDirections([]);
    setSelectedDirection(direction !== undefined ? direction : null);
    setTroopCount(0);
    setGuardSlot(0);
  }, [activeStructureId, direction]);

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
      .filter((slot) => Number.isInteger(slot) && slot >= 0);

    if (resolvedMaxDefenseSlots > 0 && guardSlot >= resolvedMaxDefenseSlots) {
      const clampedSlot = Math.max(0, resolvedMaxDefenseSlots - 1);
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
  }, [armyType, guardsData, guardSlot, resolvedMaxDefenseSlots, canCreateDefenseArmy]);

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

  const structureInventories = useMemo(() => {
    const map = new Map<number, TroopSelectionOption[]>();

    playerStructures.forEach((realm) => {
      const options = TROOP_TYPES.map((type) => ({
        type,
        label: formatTroopTypeLabel(type),
        tiers: TROOP_TIERS.map((tier) => {
          const resourceId = getTroopResourceId(type, tier);
          const balance = getBalance(realm.entityId, resourceId, currentDefaultTick, components).balance;
          const available = Number(divideByPrecision(balance) || 0);
          const resource = resources.find((item) => item.id === resourceId);

          return {
            tier,
            available,
            resourceTrait: resource?.trait ?? "",
          };
        }),
      }));

      map.set(realm.entityId, options);
    });

    if (activeStructureId && !map.has(activeStructureId)) {
      const options = TROOP_TYPES.map((type) => ({
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

      map.set(activeStructureId, options);
    }

    return map;
  }, [playerStructures, activeStructureId, components, currentDefaultTick]);

  const troopOptions = useMemo<TroopSelectionOption[]>(() => {
    return (
      structureInventories.get(activeStructureId ?? 0) ??
      TROOP_TYPES.map((type) => ({
        type,
        label: formatTroopTypeLabel(type),
        tiers: TROOP_TIERS.map((tier) => ({ tier, available: 0, resourceTrait: "" })),
      }))
    );
  }, [structureInventories, activeStructureId]);

  const maxAffordable = useMemo(() => {
    if (!activeStructureId) return 0;
    const resourceId = getTroopResourceId(selectedTroopCombo.type, selectedTroopCombo.tier);
    const balance = getBalance(activeStructureId, resourceId, currentDefaultTick, components).balance;
    return Number(divideByPrecision(balance) || 0);
  }, [activeStructureId, selectedTroopCombo.type, selectedTroopCombo.tier, currentDefaultTick, components]);

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

  const actionLabel = armyType
    ? "CREATE ATTACK ARMY"
    : `ADD DEFENSE - ${DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]?.toUpperCase()}`;

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
  const handleGuardSlotSelect = (slot: number) => setGuardSlot(slot);
  const handleTroopCountChange = (value: number) => setTroopCount(value);
  const handleStructureSelect = (newStructureId: number) => setSelectedStructureId(newStructureId);

  return (
    <ModalContainer title={armyType ? "Create Attack Army" : "Create Defense Army"} size="full">
      <div className="p-6 w-full h-full grid grid-cols-[320px,1fr] gap-6 bg-gradient-to-br from-brown/5 to-brown/10 rounded-lg">
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          <StructureSelectionList
            structures={playerStructures}
            selectedStructureId={activeStructureId || null}
            inventories={structureInventories}
            onSelect={handleStructureSelect}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col h-full">
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
            />
          </div>

          <div className="flex flex-col h-full space-y-6">
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

            {!armyType && (
              <DefenseSlotSelection
                guardSlot={guardSlot}
                maxDefenseSlots={resolvedMaxDefenseSlots}
                guardsBySlot={guardsBySlot}
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
    </ModalContainer>
  );
};
