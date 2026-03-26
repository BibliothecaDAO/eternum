import { getRealmInfo } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { ClientComponents, RealmInfo } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";

const buildOwnedStructureInfos = (
  playerStructures: ReturnType<typeof usePlayerStructures>,
  components: ClientComponents,
) =>
  playerStructures
    .map((structure) => getRealmInfo(getEntityIdFromKeys([BigInt(structure.entityId)]), components))
    .filter((structureInfo): structureInfo is RealmInfo => Boolean(structureInfo));

export const useOwnedStructureInfos = () => {
  const {
    setup: { components },
  } = useDojo();
  const playerStructures = usePlayerStructures();

  return useMemo(() => buildOwnedStructureInfos(playerStructures, components), [playerStructures, components]);
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
