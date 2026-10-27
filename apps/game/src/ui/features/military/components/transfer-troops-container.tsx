import { MAX_ARMY_SIZE } from "@/ui/design-system/kit/words";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";

import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { HudButton, HudTroopAmount, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";

import {
  configManager,
  divideByPrecision,
  getGuardSlotCooldownRemaining,
  getGuardsByStructure,
  getTroopResourceId,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import {
  ActorType,
  DISPLAYED_SLOT_NUMBER_MAP,
  formatCharge,
  formatExact,
  formatGain,
  formatWait,
  getDirectionBetweenAdjacentHexes,
  GuardSlot,
  guardSlotName,
  ID,
  RELICS,
  ResourcesIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";

import { useCallback, useEffect, useMemo, useState } from "react";
import { structureGuardSlots } from "../utils/defense-slot-utils";
import { getGuardStaminaSnapshot } from "../utils/guard-stamina";
import { TransferBalanceCardData, TransferBalanceCards } from "./transfer-troops/transfer-balance-cards";
import { getActorTypes, TransferDirection } from "./transfer-troops/transfer-direction";
import {
  acceptsTroops,
  BALANCE_TRANSFER_SLOT,
  getTroopTransferBlockReason,
} from "./transfer-troops/transfer-eligibility";
import { TransferSlotSelection } from "./transfer-troops/transfer-slot-selection";
import { toast } from "@/ui/features/event-feed/notify";

interface TransferTroopsContainerProps {
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedHex: { x: number; y: number };
  targetHex: { x: number; y: number };
  transferDirection: TransferDirection;
  onTransferComplete: () => void;
  onToggleDirection?: () => void;
  canToggleDirection?: boolean;
}

const BALANCE_SLOT = BALANCE_TRANSFER_SLOT;

type GuardSelection = number | typeof BALANCE_SLOT | null;

type RelicResourceTransfer = {
  resourceId: number;
  amount: number;
};

const RELIC_RESOURCE_IDS: number[] = RELICS.map((relic) => Number(relic.id));

/**
 * One entry per open guard slot, in the order given. The guard list leaves out a slot that never held troops; it is
 * entered here as empty (no troops) rather than missing, so every check reads an empty slot the same way. Unknown
 * guard facts give no entries.
 */
const guardSlotsOf = (
  structure: Parameters<typeof getGuardsByStructure>[0] | undefined,
  openSlots: readonly number[],
  store: Parameters<typeof getGuardsByStructure>[1],
  currentDefaultTick: number,
  currentBlockTimestamp: number,
) => {
  const guards = structure ? getGuardsByStructure(structure, store) : undefined;
  if (!guards) return [];
  return openSlots.map((slot) => {
    const guard = guards.find((entry) => Number(entry.slot) === slot);
    if (!guard) return { slot, troops: undefined, cooldownRemaining: 0 };
    const staminaSnapshot = getGuardStaminaSnapshot(guard.troops, currentDefaultTick);
    return {
      slot,
      cooldownRemaining: getGuardSlotCooldownRemaining(guard, currentBlockTimestamp),
      troops: {
        ...guard.troops,
        tier: guard.troops.tier as TroopTier,
        category: guard.troops.category as TroopType,
        count: divideByPrecision(Number(guard.troops.count)),
        staminaCurrent: staminaSnapshot?.current,
        staminaMax: staminaSnapshot?.max,
      },
    };
  });
};

export const TransferTroopsContainer = ({
  selectedEntityId,
  targetEntityId,
  selectedHex,
  targetHex,
  transferDirection,
  onTransferComplete,
  onToggleDirection,
  canToggleDirection = false,
}: TransferTroopsContainerProps) => {
  const {
    account: { account },
    setup: {
      store,
      systemCalls: {
        explorer_explorer_swap,
        explorer_guard_swap,
        guard_explorer_swap,
        explorer_add,
        troop_troop_adjacent_transfer,
        troop_structure_adjacent_transfer,
      },
    },
  } = useGame();
  const { currentBlockTimestamp, currentDefaultTick } = useBlockTimestamp();

  const [loading, setLoading] = useState(false);
  const [troopAmount, setTroopAmount] = useState<number>(0);
  const [guardSlot, setGuardSlot] = useState<GuardSelection>(null);
  const guardFacts = useNativeFacts(["Guard"]);
  const actorTypes = useMemo(() => getActorTypes(transferDirection), [transferDirection]);
  const selectedStructure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: selectedEntityId,
  });
  const selectedResourceState = useResourceManager(selectedEntityId);
  const selectedExplorerTroops = useNativeRow("ExplorerTroops", {
    game_id: configManager.getActiveGameId(),
    explorer_id: selectedEntityId,
  });
  const targetStructure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: targetEntityId,
  });
  const targetExplorerTroops = useNativeRow("ExplorerTroops", {
    game_id: configManager.getActiveGameId(),
    explorer_id: targetEntityId,
  });
  const selectedExplorerConnectedStructure = useNativeRow(
    "Structure",
    selectedExplorerTroops
      ? { game_id: configManager.getActiveGameId(), entity_id: selectedExplorerTroops.owner }
      : undefined,
  );
  const targetExplorerConnectedStructure = useNativeRow(
    "Structure",
    targetExplorerTroops
      ? { game_id: configManager.getActiveGameId(), entity_id: targetExplorerTroops.owner }
      : undefined,
  );
  const isSelectedLoading =
    actorTypes.selected === ActorType.Structure
      ? selectedStructure === undefined
      : selectedExplorerTroops === undefined;
  const isTargetLoading =
    actorTypes.target === ActorType.Structure ? targetStructure === undefined : targetExplorerTroops === undefined;

  const isStructureOwnerOfExplorer = useMemo(() => {
    return targetExplorerTroops?.owner === BigInt(selectedEntityId);
  }, [selectedEntityId, targetExplorerTroops?.owner]);

  const structureTroopBalance = useMemo(() => {
    if (!targetExplorerTroops?.troops) return undefined;
    const { category, tier } = targetExplorerTroops.troops;
    const resourceId = getTroopResourceId(category as TroopType, tier as TroopTier);
    // A structure whose resources this client cannot see offers no troop balance.
    const balance = selectedResourceState.balanceWithProduction(currentDefaultTick, resourceId)?.balance;
    if (balance === undefined) return undefined;
    return { resourceId, balance, category, tier };
  }, [currentDefaultTick, selectedResourceState, targetExplorerTroops?.troops]);
  const transferRestriction = useMemo(
    () =>
      getTroopTransferBlockReason({
        transferDirection,
        selectedEntityId,
        sourceHomeOwner: selectedExplorerConnectedStructure?.owner,
        targetOwner: targetStructure?.owner,
        targetExplorerOwner: targetExplorerTroops?.owner ?? null,
        guardSlot,
      }),
    [
      guardSlot,
      selectedEntityId,
      selectedExplorerConnectedStructure?.owner,
      targetStructure?.owner,
      targetExplorerTroops?.owner,
      transferDirection,
    ],
  );
  const isTransferBlocked = transferRestriction !== null;

  const troopCapacityLimit = useMemo(() => {
    // The contract checks the receiving army at the tier it ends up holding; a guard slot holds the arriving troops'.
    const receivingTier =
      transferDirection === TransferDirection.ExplorerToStructure
        ? selectedExplorerTroops?.troops?.tier
        : targetExplorerTroops?.troops?.tier;
    const tier = (receivingTier as TroopTier) ?? TroopTier.T1;
    // A target still loading has no known level, so no cap is shown until it arrives.
    const level = targetStructure?.base.level ?? targetExplorerConnectedStructure?.base.level;
    return level === undefined ? null : configManager.getMaxArmySize(level, tier) || null;
  }, [
    transferDirection,
    selectedExplorerTroops?.troops?.tier,
    targetExplorerTroops?.troops?.tier,
    targetStructure?.base?.level,
    targetExplorerConnectedStructure?.base?.level,
  ]);

  const directionLabel = useMemo(() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return "Explorer → Structure";
    }
    if (transferDirection === TransferDirection.StructureToExplorer) {
      return "Structure → Explorer";
    }
    return "Explorer → Explorer";
  }, [transferDirection]);

  const isBalanceSelected = guardSlot === BALANCE_SLOT;

  const selectedStructureGuardSlots = useMemo(() => structureGuardSlots(selectedStructure), [selectedStructure]);

  const targetStructureGuardSlots = useMemo(() => structureGuardSlots(targetStructure), [targetStructure]);

  const availableGuards = useMemo<number[]>(() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return targetStructureGuardSlots;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      return selectedStructureGuardSlots;
    }

    return [];
  }, [selectedStructureGuardSlots, targetStructureGuardSlots, transferDirection]);

  const orderedGuardSlots = useMemo(() => availableGuards.toSorted((a, b) => b - a), [availableGuards]);
  const visualGuardSlots = useMemo(
    () =>
      availableGuards.toSorted(
        (a, b) =>
          DISPLAYED_SLOT_NUMBER_MAP[a as keyof typeof DISPLAYED_SLOT_NUMBER_MAP] -
          DISPLAYED_SLOT_NUMBER_MAP[b as keyof typeof DISPLAYED_SLOT_NUMBER_MAP],
      ),
    [availableGuards],
  );
  const lastGuardSlot = orderedGuardSlots[0];
  const frontlineSlot = orderedGuardSlots[orderedGuardSlots.length - 1];

  const guardSelectionRequired = useMemo(() => {
    return (
      transferDirection === TransferDirection.StructureToExplorer ||
      transferDirection === TransferDirection.ExplorerToStructure
    );
  }, [transferDirection]);

  const guardFactsKnown = Boolean(
    (!targetStructure || getGuardsByStructure(targetStructure, store)) &&
    (!selectedStructure || getGuardsByStructure(selectedStructure, store)),
  );
  const targetGuards = useMemo(
    () =>
      guardSlotsOf(
        targetStructure,
        targetStructureGuardSlots,
        guardFacts.store,
        currentDefaultTick,
        currentBlockTimestamp,
      ),
    [guardFacts, targetStructure, targetStructureGuardSlots, currentDefaultTick, currentBlockTimestamp],
  );
  const selectedGuards = useMemo(
    () =>
      guardSlotsOf(
        selectedStructure,
        selectedStructureGuardSlots,
        guardFacts.store,
        currentDefaultTick,
        currentBlockTimestamp,
      ),
    [guardFacts, selectedStructure, selectedStructureGuardSlots, currentDefaultTick, currentBlockTimestamp],
  );

  const selectedTroop = useMemo(() => {
    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (isBalanceSelected && structureTroopBalance) {
        return {
          category: structureTroopBalance.category as TroopType,
          tier: structureTroopBalance.tier as TroopTier,
          count: divideByPrecision(Number(structureTroopBalance.balance)),
        };
      }

      if (typeof guardSlot === "number") {
        return selectedGuards.find((entry) => entry.slot === guardSlot)?.troops ?? null;
      }
    }
    return null;
  }, [transferDirection, isBalanceSelected, structureTroopBalance, selectedGuards, guardSlot]);

  const selectedExplorerCount = useMemo(() => {
    const count = selectedExplorerTroops?.troops.count;
    if (count === undefined) return 0;
    return divideByPrecision(Number(count));
  }, [selectedExplorerTroops?.troops.count]);

  const targetExplorerCount = useMemo(() => {
    const count = targetExplorerTroops?.troops.count;
    if (count === undefined) return 0;
    return divideByPrecision(Number(count));
  }, [targetExplorerTroops?.troops.count]);

  const structureBalanceCount = useMemo(() => {
    if (!structureTroopBalance) return 0;
    return divideByPrecision(Number(structureTroopBalance.balance));
  }, [structureTroopBalance]);

  const structureBalanceTroopInfo = structureTroopBalance
    ? {
        category: structureTroopBalance.category as TroopType,
        tier: structureTroopBalance.tier as TroopTier,
        count: structureBalanceCount,
      }
    : null;

  const balanceMatchesDestination =
    !!structureBalanceTroopInfo && acceptsTroops(targetExplorerTroops?.troops, structureBalanceTroopInfo);

  const canShowStructureBalanceOption =
    transferDirection === TransferDirection.StructureToExplorer && !!structureBalanceTroopInfo;

  const balanceOptionMismatch = canShowStructureBalanceOption && !balanceMatchesDestination;

  const balanceOptionDisabled =
    balanceOptionMismatch || !isStructureOwnerOfExplorer || (structureBalanceTroopInfo?.count ?? 0) <= 0;

  const balanceOptionDisabledReason = (() => {
    if (!structureBalanceTroopInfo) {
      return null;
    }

    if (balanceOptionMismatch && targetExplorerTroops?.troops) {
      return `Needs ${targetExplorerTroops.troops.tier} ${targetExplorerTroops.troops.category}, has ${structureBalanceTroopInfo.tier} ${structureBalanceTroopInfo.category}`;
    }

    if (!isStructureOwnerOfExplorer) {
      return "Explorer is not owned by this structure";
    }

    return null;
  })();

  // `held` is what the source holds; `maxTroops` what of it fits where it goes (and may leave), never more.
  const { maxTroops, held, capacityBlocked } = useMemo<{
    maxTroops: number;
    held: number;
    capacityBlocked: { type: "explorer" } | { type: "guard"; slotIndex: number } | null;
  }>(() => {
    const cap = troopCapacityLimit;
    const capLimit = cap !== null ? cap : Number.POSITIVE_INFINITY;

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetCapacity = Math.max(0, capLimit - targetExplorerCount);
      if (cap !== null && targetCapacity <= 0) {
        return { maxTroops: 0, held: 0, capacityBlocked: { type: "explorer" as const } };
      }
      const sourceAvailable = isBalanceSelected
        ? structureBalanceCount
        : typeof guardSlot === "number"
          ? (() => {
              const availableValue = selectedGuards.find((guard) => guard.slot === guardSlot)?.troops?.count ?? 0;
              return Number.isFinite(availableValue) ? availableValue : 0;
            })()
          : 0;
      return { maxTroops: Math.min(sourceAvailable, targetCapacity), held: sourceAvailable, capacityBlocked: null };
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (typeof guardSlot !== "number") {
        return { maxTroops: 0, held: 0, capacityBlocked: null };
      }
      const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
      const targetGuardCountValue = targetGuard?.troops?.count ?? 0;
      const targetGuardCount = Number.isFinite(targetGuardCountValue) ? targetGuardCountValue : 0;
      const guardCapacity = Math.max(0, capLimit - targetGuardCount);
      if (cap !== null && guardCapacity <= 0) {
        return { maxTroops: 0, held: 0, capacityBlocked: { type: "guard" as const, slotIndex: guardSlot } };
      }
      const availableFromExplorer = Math.max(0, selectedExplorerCount - 1);
      return {
        maxTroops: Math.min(availableFromExplorer, guardCapacity),
        held: availableFromExplorer,
        capacityBlocked: null,
      };
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      const targetCapacity = Math.max(0, capLimit - targetExplorerCount);
      if (cap !== null && targetCapacity <= 0) {
        return { maxTroops: 0, held: 0, capacityBlocked: { type: "explorer" as const } };
      }
      return {
        maxTroops: Math.min(selectedExplorerCount, targetCapacity),
        held: selectedExplorerCount,
        capacityBlocked: null,
      };
    }

    return { maxTroops: 0, held: 0, capacityBlocked: null };
  }, [
    troopCapacityLimit,
    transferDirection,
    targetExplorerCount,
    isBalanceSelected,
    structureBalanceCount,
    guardSlot,
    selectedGuards,
    selectedExplorerCount,
    targetGuards,
  ]);

  const capacityRemainingTarget = useMemo(() => {
    if (troopCapacityLimit === null) {
      return null;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      return Math.max(0, troopCapacityLimit - targetExplorerCount);
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (typeof guardSlot === "number") {
        const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
        const targetGuardCountValue = Number(targetGuard?.troops?.count ?? 0);
        const targetGuardCount = Number.isFinite(targetGuardCountValue) ? targetGuardCountValue : 0;
        return Math.max(0, troopCapacityLimit - targetGuardCount);
      }
      return null;
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      return Math.max(0, troopCapacityLimit - targetExplorerCount);
    }

    return null;
  }, [troopCapacityLimit, transferDirection, guardSlot, targetExplorerCount, targetGuards]);

  const capacityRemainingDisplay =
    capacityRemainingTarget !== null && Number.isFinite(capacityRemainingTarget)
      ? Math.max(0, Math.floor(capacityRemainingTarget))
      : null;

  const effectiveTroopAmount = Math.max(0, Math.min(troopAmount, maxTroops));

  useEffect(() => {
    setTroopAmount((current) => Math.max(0, Math.min(current, maxTroops)));
  }, [maxTroops]);
  const capacityRemainingAfterTransfer =
    capacityRemainingTarget !== null && Number.isFinite(capacityRemainingTarget)
      ? Math.max(0, capacityRemainingTarget - effectiveTroopAmount)
      : null;

  const capacityBlockedMessage = useMemo(() => {
    if (troopCapacityLimit === null || !capacityBlocked) {
      return null;
    }

    const limitText = formatExact(troopCapacityLimit);

    if (capacityBlocked.type === "guard" && typeof capacityBlocked.slotIndex === "number") {
      return `Slot ${DISPLAYED_SLOT_NUMBER_MAP[capacityBlocked.slotIndex as keyof typeof DISPLAYED_SLOT_NUMBER_MAP]} is full: ${limitText} troops`;
    }

    return `The army is full: ${limitText} troops`;
  }, [capacityBlocked, troopCapacityLimit]);

  // How many troops the receiving side holds at most, and whether this amount fills it: information, never an error.
  const capacityNotice = useMemo(() => {
    if (troopCapacityLimit === null) {
      return null;
    }

    if (capacityRemainingDisplay === null) {
      return null;
    }

    const limitText = formatExact(troopCapacityLimit);
    const remainingAfter =
      capacityRemainingAfterTransfer !== null ? capacityRemainingAfterTransfer : capacityRemainingDisplay;

    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (remainingAfter === 0 && effectiveTroopAmount > 0) {
        return `Reaches its ${MAX_ARMY_SIZE.toLowerCase()}: ${limitText} troops`;
      }

      return `${MAX_ARMY_SIZE}: ${limitText}`;
    }

    if (transferDirection === TransferDirection.ExplorerToStructure && typeof guardSlot === "number") {
      const guardName = guardSlotName(guardSlot as GuardSlot);
      if (remainingAfter === 0 && effectiveTroopAmount > 0) {
        return `${guardName} will hit its deployment cap (${limitText} troops for this tier).`;
      }

      return `Max troops: ${limitText}`;
    }

    if (transferDirection === TransferDirection.ExplorerToExplorer) {
      if (remainingAfter === 0 && effectiveTroopAmount > 0) {
        return `Reaches its ${MAX_ARMY_SIZE.toLowerCase()}: ${limitText} troops`;
      }

      return `${MAX_ARMY_SIZE}: ${limitText}`;
    }

    return null;
  }, [
    capacityRemainingAfterTransfer,
    capacityRemainingDisplay,
    effectiveTroopAmount,
    guardSlot,
    transferDirection,
    troopCapacityLimit,
  ]);

  const findDefaultGuardSlot = useCallback((): GuardSelection => {
    if (!guardSelectionRequired) {
      return null;
    }

    if (transferDirection === TransferDirection.StructureToExplorer) {
      const targetTroop = targetExplorerTroops?.troops;
      const canUseBalance =
        Boolean(structureTroopBalance) &&
        isStructureOwnerOfExplorer &&
        structureBalanceCount > 0 &&
        acceptsTroops(targetTroop, structureTroopBalance);

      if (canUseBalance) {
        return BALANCE_SLOT;
      }

      const source = selectedGuards.find(
        (guard) => (guard.troops?.count ?? 0) > 0 && acceptsTroops(targetTroop, guard.troops),
      );
      if (source) return source.slot;
    }

    if (transferDirection === TransferDirection.ExplorerToStructure) {
      const explorerTroop = selectedExplorerTroops?.troops;
      if (!explorerTroop) {
        return null;
      }

      const receiver = targetGuards.find(
        (guard) => guard.cooldownRemaining <= 0 && acceptsTroops(guard.troops, explorerTroop),
      );
      if (receiver) return receiver.slot;
    }

    return null;
  }, [
    guardSelectionRequired,
    transferDirection,
    structureTroopBalance,
    structureBalanceCount,
    isStructureOwnerOfExplorer,
    targetExplorerTroops,
    selectedGuards,
    selectedExplorerTroops,
    targetGuards,
  ]);

  useEffect(() => {
    setTroopAmount(0);
  }, [transferDirection, guardSlot]);

  useEffect(() => {
    if (!guardSelectionRequired) {
      if (guardSlot !== null) {
        setGuardSlot(null);
      }
      return;
    }

    if (guardSlot === BALANCE_SLOT) {
      if (transferDirection !== TransferDirection.StructureToExplorer) {
        setGuardSlot(null);
      }
      return;
    }

    if (typeof guardSlot === "number" && !availableGuards.includes(guardSlot)) {
      setGuardSlot(null);
    }
  }, [guardSelectionRequired, availableGuards, guardSlot, transferDirection]);

  useEffect(() => {
    if (!guardSelectionRequired) {
      return;
    }

    if (guardSlot === BALANCE_SLOT) {
      if (transferDirection === TransferDirection.StructureToExplorer) {
        return;
      }
      setGuardSlot(null);
      return;
    }

    if (typeof guardSlot === "number" && availableGuards.includes(guardSlot)) {
      return;
    }

    const defaultSlot = findDefaultGuardSlot();
    if (defaultSlot !== null) {
      setGuardSlot(defaultSlot);
    }
  }, [guardSelectionRequired, availableGuards, guardSlot, transferDirection, findDefaultGuardSlot]);

  useEffect(() => {
    if (transferDirection !== TransferDirection.ExplorerToStructure) {
      return;
    }

    if (typeof guardSlot !== "number") {
      return;
    }

    const guard = targetGuards.find((entry) => entry.slot === guardSlot);
    if (!guard) {
      return;
    }

    if (guard.cooldownRemaining > 0) {
      setGuardSlot(null);
    }
  }, [transferDirection, guardSlot, targetGuards]);

  // Handle transfer
  const handleTransfer = async () => {
    if (!selectedHex || !targetEntityId) return;
    if (isTransferBlocked) return;

    const direction = getDirectionBetweenAdjacentHexes(
      { col: selectedHex.x, row: selectedHex.y },
      { col: targetHex.x, row: targetHex.y },
    );
    if (direction === null) return;

    try {
      setLoading(true);

      // maxTroops is derived from live native store rows. Re-apply it at submit time so
      // a concurrent spend cannot leave stale troop calldata in this panel.
      if (effectiveTroopAmount <= 0) return;
      const troopAmountWithPrecision = multiplyByPrecision(effectiveTroopAmount);
      if (transferDirection === TransferDirection.ExplorerToStructure && typeof guardSlot !== "number") {
        return;
      }

      const sourceExplorerCount = selectedExplorerTroops?.troops.count ?? null;
      const willEmptySourceExplorer =
        (transferDirection === TransferDirection.ExplorerToExplorer ||
          transferDirection === TransferDirection.ExplorerToStructure) &&
        sourceExplorerCount !== null &&
        BigInt(troopAmountWithPrecision) >= sourceExplorerCount;

      if (willEmptySourceExplorer) {
        if (!selectedResourceState.hasResources()) {
          throw new Error("Unable to load explorer resources for auto relic transfer");
        }

        const relicResources: RelicResourceTransfer[] = RELIC_RESOURCE_IDS.map((resourceId) => {
          const { balance } = selectedResourceState.balanceWithProduction(
            currentDefaultTick,
            resourceId as ResourcesIds,
          )!;
          return {
            resourceId,
            amount: balance,
          };
        }).filter((entry) => entry.amount > 0);

        if (relicResources.length > 0) {
          if (transferDirection === TransferDirection.ExplorerToExplorer) {
            await troop_troop_adjacent_transfer({
              signer: account,
              from_troop_id: selectedEntityId,
              to_troop_id: targetEntityId,
              resources: relicResources,
            });
          }

          if (transferDirection === TransferDirection.ExplorerToStructure) {
            await troop_structure_adjacent_transfer({
              signer: account,
              from_explorer_id: selectedEntityId,
              to_structure_id: targetEntityId,
              resources: relicResources,
            });
          }
        }
      }

      if (transferDirection === TransferDirection.StructureToExplorer) {
        if (guardSlot === BALANCE_SLOT && structureTroopBalance) {
          // Get home direction for the explorer
          const homeDirection = getDirectionBetweenAdjacentHexes(
            // from army to structure to find home direction
            { col: targetHex.x, row: targetHex.y },
            { col: selectedHex.x, row: selectedHex.y },
          );
          if (homeDirection === null) return;

          await explorer_add({
            signer: account,
            to_explorer_id: targetEntityId,
            amount: troopAmountWithPrecision,
            home_direction: homeDirection,
          });
        } else if (typeof guardSlot === "number") {
          await guard_explorer_swap({
            signer: account,
            from_structure_id: selectedEntityId,
            from_guard_slot: guardSlot,
            to_explorer_id: targetEntityId,
            to_explorer_direction: direction,
            count: troopAmountWithPrecision,
          });
        } else {
          return;
        }
      } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
        await explorer_explorer_swap({
          signer: account,
          from_explorer_id: selectedEntityId,
          to_explorer_id: targetEntityId,
          to_explorer_direction: direction,
          count: troopAmountWithPrecision,
        });
      } else if (transferDirection === TransferDirection.ExplorerToStructure) {
        if (typeof guardSlot !== "number") return;

        const calldata = {
          signer: account,
          from_explorer_id: selectedEntityId,
          to_structure_id: targetEntityId,
          to_structure_direction: direction,
          to_guard_slot: guardSlot,
          count: troopAmountWithPrecision,
        };
        await explorer_guard_swap(calldata);
      }

      onTransferComplete();
    } catch (error) {
      toast.failed(error, "The troops could not be moved.");
    } finally {
      setLoading(false);
    }
  };

  /** The troops leaving and the army or guard slot taking them, for the chosen direction and slot. */
  const receivingGuard =
    transferDirection === TransferDirection.ExplorerToStructure && typeof guardSlot === "number"
      ? targetGuards.find((guard) => guard.slot === guardSlot)
      : undefined;
  const { incoming, holder } = (() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return { incoming: selectedExplorerTroops?.troops, holder: receivingGuard?.troops };
    }
    if (transferDirection === TransferDirection.StructureToExplorer) {
      return {
        incoming: guardSlot === BALANCE_SLOT ? structureTroopBalance : selectedTroop,
        holder: targetExplorerTroops?.troops,
      };
    }
    return { incoming: selectedExplorerTroops?.troops, holder: targetExplorerTroops?.troops };
  })();
  const troopMismatch = !!incoming && !acceptsTroops(holder, incoming);

  const isTroopsTransferDisabled =
    isTransferBlocked ||
    troopAmount === 0 ||
    (guardSelectionRequired && guardSlot === null) ||
    (transferDirection === TransferDirection.ExplorerToStructure &&
      (!receivingGuard || receivingGuard.cooldownRemaining > 0)) ||
    !incoming ||
    troopMismatch;

  const troopMismatchMessage = troopMismatch
    ? `Troops differ: ${incoming?.tier} ${incoming?.category} ≠ ${holder?.tier} ${holder?.category}`
    : null;

  // What the player has still to choose is the button's own words, never an error: an error answers an action.
  const nextStep = (() => {
    if (guardSelectionRequired && guardSlot === null) return "Choose a guard slot";
    if (troopAmount === 0) return "Choose an amount";
    return null;
  })();

  // A fact of the game that keeps the transfer closed, said calmly: nothing the player did failed.
  const blockReason =
    transferRestriction ??
    capacityBlockedMessage ??
    troopMismatchMessage ??
    (receivingGuard && receivingGuard.cooldownRemaining > 0
      ? `This slot is rebuilding (${formatWait(receivingGuard.cooldownRemaining)} remaining).`
      : null);

  const transferBalanceCards = useMemo<TransferBalanceCardData[]>(() => {
    if (troopAmount <= 0) return [];
    const cards: TransferBalanceCardData[] = [];

    const pushCard = (
      label: string,
      beforeRaw: number,
      afterRaw: number,
      gainText = "gain",
      lossText = "sent",
      troop?: { tier: TroopTier | string; category: TroopType | string },
    ) => {
      const before = Math.max(0, beforeRaw);
      const after = Math.max(0, afterRaw);
      const delta = after - before;
      let tone: "positive" | "negative" | "neutral" = "neutral";
      let changeLabel = "No change";

      if (delta > 0) {
        tone = "positive";
        changeLabel = `${formatGain(delta)} ${gainText}`;
      } else if (delta < 0) {
        tone = "negative";
        changeLabel = `-${formatCharge(Math.abs(delta))} ${lossText}`;
      }

      cards.push({ label, before, after, tone, changeLabel, troop });
    };

    if (transferDirection === TransferDirection.StructureToExplorer) {
      if (guardSlot === BALANCE_SLOT && structureTroopBalance) {
        pushCard("Structure balance", structureBalanceCount, structureBalanceCount - troopAmount, "remaining", "sent", {
          tier: structureTroopBalance?.tier ?? null,
          category: structureTroopBalance?.category,
        });
      } else if (typeof guardSlot === "number") {
        const guardInfo = selectedGuards.find((guard) => guard.slot === guardSlot);
        if (guardInfo) {
          pushCard(
            guardSlotName(guardSlot as GuardSlot),
            guardInfo.troops?.count ?? 0,
            (guardInfo.troops?.count ?? 0) - troopAmount,
            "remaining",
            "sent",
            guardInfo.troops,
          );
        }
      }

      if (targetExplorerTroops) {
        pushCard("Explorer", targetExplorerCount, targetExplorerCount + troopAmount, "arriving", "remaining", {
          tier: targetExplorerTroops.troops.tier,
          category: targetExplorerTroops.troops.category,
        });
      }
    } else if (transferDirection === TransferDirection.ExplorerToStructure) {
      if (selectedExplorerTroops) {
        pushCard("Explorer", selectedExplorerCount, selectedExplorerCount - troopAmount, "remaining", "sent", {
          tier: selectedExplorerTroops.troops.tier,
          category: selectedExplorerTroops.troops.category,
        });
      }

      if (typeof guardSlot === "number") {
        const targetGuard = targetGuards.find((guard) => guard.slot === guardSlot);
        if (targetGuard) {
          pushCard(
            guardSlotName(guardSlot as GuardSlot),
            targetGuard.troops?.count ?? 0,
            (targetGuard.troops?.count ?? 0) + troopAmount,
            "arriving",
            "remaining",
            // An empty slot takes the type of the troops arriving in it.
            targetGuard.troops ?? selectedExplorerTroops?.troops,
          );
        }
      }
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      if (selectedExplorerTroops) {
        pushCard("From explorer", selectedExplorerCount, selectedExplorerCount - troopAmount, "remaining", "sent", {
          tier: selectedExplorerTroops.troops.tier,
          category: selectedExplorerTroops.troops.category,
        });
      }

      if (targetExplorerTroops) {
        pushCard("To explorer", targetExplorerCount, targetExplorerCount + troopAmount, "arriving", "remaining", {
          tier: targetExplorerTroops.troops.tier,
          category: targetExplorerTroops.troops.category,
        });
      }
    }

    return cards;
  }, [
    transferDirection,
    troopAmount,
    structureTroopBalance,
    structureBalanceCount,
    guardSlot,
    selectedGuards,
    targetGuards,
    targetExplorerTroops,
    selectedExplorerTroops,
    selectedExplorerCount,
    targetExplorerCount,
  ]);

  const selectedTroopForSlots = useMemo(() => {
    const troop = selectedExplorerTroops?.troops;
    if (!troop) return undefined;
    return { tier: troop.tier as TroopTier, category: troop.category as TroopType };
  }, [selectedExplorerTroops?.troops]);

  const targetTroopForSlots = useMemo(() => {
    const troop = targetExplorerTroops?.troops;
    if (!troop) return undefined;
    const rawCount = troop.count;
    const count =
      typeof rawCount === "bigint"
        ? rawCount
        : typeof rawCount === "number"
          ? rawCount
          : typeof rawCount === "string"
            ? Number(rawCount)
            : undefined;
    return { tier: troop.tier as TroopTier, category: troop.category as TroopType, count };
  }, [targetExplorerTroops?.troops]);

  return (
    <div className="flex flex-col space-y-4">
      {isTargetLoading || isSelectedLoading ? (
        <LoadingAnimation />
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex items-start justify-center gap-4">
              <div className="flex-1 min-w-0 space-y-4">
                <div className="space-y-4 rounded-md border border-hud-line bg-hud-well p-4">
                  {guardSelectionRequired && (
                    <div className="space-y-3">
                      <TransferSlotSelection
                        transferDirection={transferDirection}
                        slots={visualGuardSlots}
                        orderedSlots={orderedGuardSlots}
                        guards={
                          transferDirection === TransferDirection.StructureToExplorer ? selectedGuards : targetGuards
                        }
                        selectedSlot={guardSlot}
                        onSelect={(slot) => {
                          if (slot === BALANCE_SLOT || typeof slot === "number") {
                            setGuardSlot(slot as GuardSelection);
                          }
                        }}
                        balanceOption={{
                          key: BALANCE_SLOT,
                          visible: canShowStructureBalanceOption && !!structureBalanceTroopInfo,
                          troop: structureBalanceTroopInfo,
                          disabled: balanceOptionDisabled,
                          disabledReason: balanceOptionDisabledReason,
                        }}
                        selectedTroop={
                          transferDirection === TransferDirection.ExplorerToStructure
                            ? selectedTroopForSlots
                            : undefined
                        }
                        targetTroop={
                          transferDirection === TransferDirection.StructureToExplorer ? targetTroopForSlots : undefined
                        }
                        frontlineSlot={frontlineSlot}
                        lastGuardSlot={lastGuardSlot}
                      />
                    </div>
                  )}

                  <div className="flex flex-col space-y-2">
                    <HudTroopAmount
                      name="Troop count"
                      value={troopAmount}
                      most={maxTroops}
                      held={held}
                      onChange={(value) => setTroopAmount(Math.min(value, maxTroops))}
                      disabled={!guardFactsKnown || maxTroops <= 0}
                    />
                    {capacityNotice && (
                      <div className="rounded-md border border-hud-line px-3 py-2 text-hud-label text-hud-muted">
                        {capacityNotice}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-4 rounded-md border border-hud-line bg-hud-well p-4">
                <div className="rounded-md border border-hud-line-strong bg-hud-well p-3">
                  <div className="text-hud-label uppercase tracking-wide text-hud-muted">Transfer direction</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-hud-strong text-hud-accent">{directionLabel}</span>
                    {onToggleDirection ? (
                      <HudButton
                        kind="secondary"
                        size="sm"
                        icon="swap"
                        onClick={onToggleDirection}
                        disabled={!canToggleDirection}
                      >
                        Swap
                      </HudButton>
                    ) : null}
                  </div>
                </div>
                <TransferBalanceCards cards={transferBalanceCards} />

                <HudWindowFoot note={blockReason}>
                  <HudButton
                    kind="primary"
                    onClick={handleTransfer}
                    busy={loading ? "Processing..." : undefined}
                    disabled={isTroopsTransferDisabled}
                  >
                    {(!blockReason && nextStep) || "Transfer Troops"}
                  </HudButton>
                </HudWindowFoot>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
