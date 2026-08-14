import { getEntityIdFromKeys, getGuardsByStructure } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";

export const useGuardsByStructure = (structureEntityId: ID) => {
  const {
    setup: { components },
  } = useDojo();
  const structure = useComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureEntityId || 0)]));
  const guards = useMemo(
    () =>
      structure
        ? getGuardsByStructure(structure).filter((guard) => guard.troops?.count && guard.troops.count > 0n)
        : [],
    [structure],
  );

  return {
    guards,
    isLoading: false,
    count: guards.length,
  };
};
