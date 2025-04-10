import Button from "@/ui/elements/button";
import { formatNumber } from "@/ui/utils/utils";
import {
  getEntityIdFromKeys,
  getGuardsByStructure,
} from "@bibliothecadao/eternum";
import {
  DEFENSE_NAMES,
  ID,
  getDirectionBetweenAdjacentHexes,
} from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useState } from "react";

export enum TransferDirection {
  ExplorerToStructure,
  StructureToExplorer,
  ExplorerToExplorer,
}

interface TransferTroopsContainerProps {
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedHex: { x: number; y: number };
  targetHex: { x: number; y: number };
  transferDirection: TransferDirection;
  onTransferComplete: () => void;
}

export const TransferTroopsContainer = ({
  selectedEntityId,
  targetEntityId,
  selectedHex,
  targetHex,
  transferDirection,
  onTransferComplete,
}: TransferTroopsContainerProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { explorer_explorer_swap, explorer_guard_swap, guard_explorer_swap },
      components: { Structure, ExplorerTroops },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [troopAmount, setTroopAmount] = useState<number>(0);
  const [guardSlot, setGuardSlot] = useState<number>(0); // Default to first guard slot

  // list of guards
  const targetGuards = (() => {
    if (!targetEntityId) return [];
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(targetEntityId)]));
    if (!structure) return [];
    const guards = getGuardsByStructure(structure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: Number(guard.troops.count) / 10 ** 9,
      },
    }));
  })();

  // one explorer troop
  const targetExplorerTroops = (() => {
    if (!targetEntityId) return undefined;
    const explorers = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(targetEntityId)]));
    if (!explorers?.troops) return undefined;
    return {
      ...explorers.troops,
      count: Number(explorers.troops.count) / 10 ** 9,
    };
  })();

  // list of guards
  const selectedGuards = (() => {
    if (!selectedEntityId) return [];
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    if (!structure) return [];
    const guards = getGuardsByStructure(structure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: Number(guard.troops.count) / 10 ** 9,
      },
    }));
  })();

  // one explorer troop
  const selectedExplorerTroops = (() => {
    if (!selectedEntityId) return undefined;
    const explorers = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    if (!explorers?.troops) return undefined;
    return {
      ...explorers.troops,
      count: Number(explorers.troops.count) / 10 ** 9,
    };
  })();

  const maxTroops = (() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return Number(selectedExplorerTroops?.count || 0);
    } else if (transferDirection === TransferDirection.StructureToExplorer) {
      return Number(selectedGuards[guardSlot].troops.count);
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      return Number(selectedExplorerTroops?.count || 0);
    }
    return 0;
  })();

  // Handle troop amount change
  const handleTroopAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      // Ensure we don't exceed available troops
      setTroopAmount(Math.min(value, maxTroops));
    }
  };

  // Handle guard slot change
  const handleGuardSlotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGuardSlot(parseInt(e.target.value));
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!selectedHex || !targetEntityId) return;

    const direction = getDirectionBetweenAdjacentHexes(
      { col: selectedHex.x, row: selectedHex.y },
      { col: targetHex.x, row: targetHex.y },
    );
    if (direction === null) return;

    try {
      setLoading(true);

      // Apply precision to troop amount for the transaction
      const troopAmountWithPrecision = troopAmount * 10 ** 9;

      if (transferDirection === TransferDirection.ExplorerToExplorer) {
        await explorer_explorer_swap({
          signer: account,
          from_explorer_id: selectedEntityId,
          to_explorer_id: targetEntityId,
          to_explorer_direction: direction,
          count: troopAmountWithPrecision,
        });
      } else if (transferDirection === TransferDirection.ExplorerToStructure) {
        const calldata = {
          signer: account,
          from_explorer_id: selectedEntityId,
          to_structure_id: targetEntityId,
          to_structure_direction: direction,
          to_guard_slot: guardSlot,
          count: troopAmountWithPrecision,
        };
        await explorer_guard_swap(calldata);
      } else if (transferDirection === TransferDirection.StructureToExplorer) {
        await guard_explorer_swap({
          signer: account,
          from_structure_id: selectedEntityId,
          from_guard_slot: guardSlot,
          to_explorer_id: targetEntityId,
          to_explorer_direction: direction,
          count: troopAmountWithPrecision,
        });
      }

      onTransferComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isTroopsTransferDisabled = (() => {
    if (
      transferDirection === TransferDirection.ExplorerToStructure ||
      transferDirection === TransferDirection.StructureToExplorer
    ) {
      if (guardSlot === undefined) return true;

      // Check if troop tier and category match between selected and target
      if (transferDirection === TransferDirection.ExplorerToStructure) {
        const selectedTroop = selectedExplorerTroops;
        const targetTroop = targetGuards[guardSlot].troops;
        // If target troop count is 0, tier and category don't matter
        if (targetTroop?.count === 0) {
          return false;
        }
        return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
      } else {
        const selectedTroop = selectedGuards[guardSlot].troops;
        const targetTroop = targetExplorerTroops;
        // If target troop count is 0, tier and category don't matter
        if (targetTroop?.count === 0) {
          return false;
        }
        return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
      }
    }
    return troopAmount === 0;
  })();

  const getTroopMismatchMessage = () => {
    if (
      (transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer) &&
      guardSlot !== undefined
    ) {
      let selectedTroop, targetTroop;

      if (transferDirection === TransferDirection.ExplorerToStructure) {
        selectedTroop = selectedExplorerTroops;
        targetTroop = targetGuards[guardSlot].troops;
      } else {
        selectedTroop = selectedGuards[guardSlot].troops;
        targetTroop = targetExplorerTroops;
      }

      // If target troop count is 0, no mismatch message needed
      if (targetTroop?.count === 0) {
        return null;
      }

      if (selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category) {
        return `Troop mismatch: You can only transfer troops of the same tier and type (Tier ${selectedTroop?.tier} ${selectedTroop?.category} ≠ Tier ${targetTroop?.tier} ${targetTroop?.category})`;
      }
    }

    return null;
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-2">
        <label className="text-gold font-semibold">Troop Amount:</label>
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="0"
            max={maxTroops}
            value={troopAmount}
            onChange={handleTroopAmountChange}
            className="w-full accent-gold"
          />
          <input
            type="number"
            min="0"
            max={maxTroops}
            value={troopAmount}
            onChange={handleTroopAmountChange}
            className="w-20 px-2 py-1 bg-dark-brown border border-gold/30 rounded-md text-gold"
          />
        </div>
        <p className="text-gold/60 text-sm">Available: {formatNumber(maxTroops, 0)} troops</p>

        {/* Display selected troop type and category */}
        {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
          <p className="text-gold/80 text-sm">
            Selected Troop: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
          </p>
        )}
        {transferDirection === TransferDirection.StructureToExplorer && selectedGuards.length > 0 && (
          <p className="text-gold/80 text-sm">
            Selected Troop: Tier {selectedGuards[guardSlot].troops.tier} {selectedGuards[guardSlot].troops.category}
          </p>
        )}
        {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
          <p className="text-gold/80 text-sm">
            Selected Troop: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
          </p>
        )}
      </div>

      {(transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer) && (
          <div className="flex flex-col space-y-2">
            <label className="text-gold font-semibold">Guard Slot:</label>
            <select
              value={guardSlot}
              onChange={handleGuardSlotChange}
              className="px-2 py-1 bg-dark-brown border border-gold/30 rounded-md text-gold"
            >
              {transferDirection === TransferDirection.ExplorerToStructure ? (
                <>
                  <option
                    value={0}
                  >{`${DEFENSE_NAMES[0]} - Tier ${targetGuards[0].troops.tier} ${targetGuards[0].troops.category} (available: ${targetGuards[0].troops.count})`}</option>
                  <option
                    value={1}
                  >{`${DEFENSE_NAMES[1]} - Tier ${targetGuards[1].troops.tier} ${targetGuards[1].troops.category} (available: ${targetGuards[1].troops.count})`}</option>
                  <option
                    value={2}
                  >{`${DEFENSE_NAMES[2]} - Tier ${targetGuards[2].troops.tier} ${targetGuards[2].troops.category} (available: ${targetGuards[2].troops.count})`}</option>
                  <option
                    value={3}
                  >{`${DEFENSE_NAMES[3]} - Tier ${targetGuards[3].troops.tier} ${targetGuards[3].troops.category} (available: ${targetGuards[3].troops.count})`}</option>
                </>
              ) : (
                <>
                  <option
                    value={0}
                  >{`${DEFENSE_NAMES[0]} - Tier ${selectedGuards[0].troops.tier} ${selectedGuards[0].troops.category} (available: ${selectedGuards[0].troops.count})`}</option>
                  <option
                    value={1}
                  >{`${DEFENSE_NAMES[1]} - Tier ${selectedGuards[1].troops.tier} ${selectedGuards[1].troops.category} (available: ${selectedGuards[1].troops.count})`}</option>
                  <option
                    value={2}
                  >{`${DEFENSE_NAMES[2]} - Tier ${selectedGuards[2].troops.tier} ${selectedGuards[2].troops.category} (available: ${selectedGuards[2].troops.count})`}</option>
                  <option
                    value={3}
                  >{`${DEFENSE_NAMES[3]} - Tier ${selectedGuards[3].troops.tier} ${selectedGuards[3].troops.category} (available: ${selectedGuards[3].troops.count})`}</option>
                </>
              )}
            </select>
          </div>
        )}

      {getTroopMismatchMessage() && <div className="text-red-500 text-sm">{getTroopMismatchMessage()}</div>}

      <div className="flex justify-center mt-6">
        <Button
          onClick={handleTransfer}
          variant="primary"
          disabled={loading || isTroopsTransferDisabled}
          isLoading={loading}
          className="w-full sm:w-auto"
        >
          {loading ? "Processing..." : "Transfer Troops"}
        </Button>
      </div>
    </div>
  );
};
