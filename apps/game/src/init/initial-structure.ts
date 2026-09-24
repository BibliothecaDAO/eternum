import { useUIStore, type AppStore } from "@/hooks/store/use-ui-store";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { accountAddress, useAccountStore } from "@/hooks/store/use-account-store";
import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";
import { Position, configManager, structureMapPosition } from "@bibliothecadao/eternum";

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

/**
 * Keeps the UI on a structure for the life of the game session. The snapshot can land after boot and the account can
 * be restored after that, so a choice made once at boot left a reload with nothing selected. This chooses again when
 * the facts or the account change: the player's realm once they own one, else the first structure as a spectator.
 */
export const followInitialStructure = (setup: SetupResult): (() => void) => {
  const choose = () => chooseInitialStructure(setup, useUIStore.getState());
  choose();
  const stopFacts = setup.store.subscribe(choose);
  const stopAccount = useAccountStore.subscribe((state, previous) => {
    if (state.account !== previous.account) choose();
  });
  return () => {
    stopFacts();
    stopAccount();
  };
};

const chooseInitialStructure = (setup: SetupResult, state: AppStore): void => {
  const hasSelection = Boolean(state.structureEntityId);
  if (hasSelection && !isSpectatorFallback(state)) return;

  const viewer = accountAddress();
  const ownedStructures = viewer === null ? [] : readInitialSelectableStructures(setup, viewer);
  // A spectator fallback yields only to the player's own realm.
  if (hasSelection && ownedStructures.length === 0) return;

  const globalStructures = ownedStructures.length > 0 ? [] : readInitialSelectableStructures(setup);
  const { selectedStructure, spectator } = resolveInitialStructureSelection({ ownedStructures, globalStructures });
  if (!selectedStructure) return;

  state.setStructureEntityId(selectedStructure.entity_id, {
    spectator,
    worldMapPosition: Position.fromContract({ x: selectedStructure.coord_x, y: selectedStructure.coord_y }),
  });
};

/** Spectating because no account had arrived, not because the player asked to spectate. */
const isSpectatorFallback = (state: AppStore): boolean => state.isSpectating && !isExplicitSpectateSession();
