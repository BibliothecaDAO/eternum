import { getRealmInfo } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { usePlayerStructures } from "@/hooks/helpers/use-structures";
import { RealmInfo } from "@bibliothecadao/types";
import { useMemo } from "react";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { type PlayerNames, usePlayerNames } from "@/hooks/use-player-profile";

const buildOwnedStructureInfos = (
  playerStructures: ReturnType<typeof usePlayerStructures>,
  store: NativeFactStore,
  names: PlayerNames,
) =>
  playerStructures
    .map((structure) => getRealmInfo(structure.entityId, store, names.text))
    .filter((structureInfo): structureInfo is RealmInfo => Boolean(structureInfo));

const useOwnedStructureInfos = () => {
  const {
    setup: { store },
  } = useGame();
  const playerStructures = usePlayerStructures();
  const revision = useNativeRevision(["StructureBuildings", "ResourceWeight"]);
  const names = usePlayerNames();

  return useMemo(
    () => buildOwnedStructureInfos(playerStructures, store, names),
    [playerStructures, store, revision, names],
  );
};

export const useOwnedMilitaryStructureInfos = () => {
  const ownedStructureInfos = useOwnedStructureInfos();

  return useMemo(
    () =>
      ownedStructureInfos.filter((structureInfo) => {
        const capabilities = resolveStructureUiCapabilities(structureInfo.structure);
        return capabilities.canCreateFieldArmy || capabilities.canManageGuardArmy;
      }),
    [ownedStructureInfos],
  );
};

export const useOwnedProductionStructureInfos = () => {
  const ownedStructureInfos = useOwnedStructureInfos();

  return useMemo(
    () =>
      ownedStructureInfos.filter(
        (structureInfo) => resolveStructureUiCapabilities(structureInfo.structure).canOpenProduction,
      ),
    [ownedStructureInfos],
  );
};
