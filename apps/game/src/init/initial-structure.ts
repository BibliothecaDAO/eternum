import type { AppStore } from "@/hooks/store/use-ui-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";
import { configManager, structureMapPosition } from "@bibliothecadao/eternum";

import { resolveInitialStructureSelection } from "../sync/initial-structure-selection";

interface InitialSelectableStructure {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  category: number;
}

const readInitialSelectableStructures = (setup: SetupResult, owner?: bigint): InitialSelectableStructure[] => {
  const gameId = configManager.getActiveGameId();
  const structures =
    owner === undefined ? setup.store.inGame("Structure", gameId) : setup.store.structuresOwnedBy(gameId, owner);
  return [...structures]
    .map((structure) => {
      const position = structureMapPosition(setup.store, structure);
      return {
        entity_id: structure.entity_id,
        coord_x: position.x,
        coord_y: position.y,
        category: structure.base.category,
      };
    })
    .sort((left, right) => left.entity_id - right.entity_id);
};

const resolveConnectedAccountAddress = (): string | undefined => {
  const accountAddress = useAccountStore.getState().account?.address;
  const hasConnectedAccount =
    typeof accountAddress === "string" && accountAddress.length > 0 && accountAddress !== "0x0";
  return hasConnectedAccount ? accountAddress : undefined;
};

/** Opens the UI on the player's realm, or the first structure in spectator mode, once the native snapshot is applied. */
export const selectInitialStructure = (setup: SetupResult, state: AppStore): void => {
  if (state.structureEntityId && state.structureEntityId !== 0) return;

  const address = resolveConnectedAccountAddress();
  const ownedStructures = address ? readInitialSelectableStructures(setup, BigInt(address)) : [];
  const firstGlobalStructure = ownedStructures.length > 0 ? null : (readInitialSelectableStructures(setup)[0] ?? null);
  const { selectedStructure, spectator } = resolveInitialStructureSelection({
    ownedStructures,
    firstGlobalStructure,
  });
  if (!selectedStructure) return;

  state.setStructureEntityId(selectedStructure.entity_id, {
    spectator,
    worldMapPosition: { col: selectedStructure.coord_x, row: selectedStructure.coord_y },
  });
};
