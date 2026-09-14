import type { AppStore } from "@/hooks/store/use-ui-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import type { SetupResult } from "@bibliothecadao/dojo";
import { gameEntityKey } from "@bibliothecadao/eternum/game-client";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";

import { resolveInitialStructureSelection } from "../sync/initial-structure-selection";

interface InitialSelectableStructure {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  category: number;
}

const readInitialSelectableStructures = (setup: SetupResult): InitialSelectableStructure[] =>
  Array.from(runQuery([Has(setup.components.Structure)]))
    .flatMap((entity) => {
      const structure = getComponentValue(setup.components.Structure, entity);
      if (!structure) return [];

      return [
        {
          entity_id: Number(structure.entity_id),
          coord_x: Number(structure.base.coord_x),
          coord_y: Number(structure.base.coord_y),
          category: Number(structure.base.category),
        },
      ];
    })
    .sort((left, right) => left.entity_id - right.entity_id);

const readOwnedInitialStructures = (
  setup: SetupResult,
  ownerAddress: string | undefined,
): InitialSelectableStructure[] => {
  if (!ownerAddress) return [];
  const owner = BigInt(ownerAddress);
  return readInitialSelectableStructures(setup).filter((candidate) => {
    const structure = getComponentValue(setup.components.Structure, gameEntityKey([BigInt(candidate.entity_id)]));
    return structure?.owner === owner;
  });
};

const resolveConnectedAccountAddress = (): string | undefined => {
  const accountAddress = useAccountStore.getState().account?.address;
  const hasConnectedAccount =
    typeof accountAddress === "string" && accountAddress.length > 0 && accountAddress !== "0x0";
  return hasConnectedAccount ? accountAddress : undefined;
};

/** Opens the UI on the player's realm, or the first structure in spectator mode, once the snapshot is in RECS. */
export const selectInitialStructure = (setup: SetupResult, state: AppStore): void => {
  if (state.structureEntityId && state.structureEntityId !== 0) return;

  const ownedStructures = readOwnedInitialStructures(setup, resolveConnectedAccountAddress());
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
