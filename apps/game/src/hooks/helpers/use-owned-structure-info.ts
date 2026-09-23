import { getRealmInfo } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { usePlayerStructures } from "@/hooks/helpers/use-structures";
import { RealmInfo } from "@bibliothecadao/types";
import { useMemo } from "react";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { type NativeFactStore } from "@bibliothecadao/eternum/game-client";

const buildOwnedStructureInfos = (playerStructures: ReturnType<typeof usePlayerStructures>, store: NativeFactStore) =>
  playerStructures
    .map((structure) => getRealmInfo(structure.entityId, store))
    .filter((structureInfo): structureInfo is RealmInfo => Boolean(structureInfo));

const useOwnedStructureInfos = () => {
  const {
    setup: { store },
  } = useGame();
  const playerStructures = usePlayerStructures();
  const revision = useNativeRevision(["StructureBuildings", "ResourceWeight"]);

  return useMemo(() => buildOwnedStructureInfos(playerStructures, store), [playerStructures, store, revision]);
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
