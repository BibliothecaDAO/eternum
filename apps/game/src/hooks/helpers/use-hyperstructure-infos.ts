import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { DEFAULT_COORD_ALT, getAddressNameFromEntity } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, type HyperstructureInfo } from "@bibliothecadao/types";
import { useMemo } from "react";

/** Every hyperstructure with its structure row and owner, derived from the bridge's slices once per ingest slice. */
export const useHyperstructureInfos = (): HyperstructureInfo[] => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();
  const hyperstructures = useWorldSlicesStore((state) => state.hyperstructures);
  const structures = useWorldSlicesStore((state) => state.structures);

  return useMemo(() => {
    const structuresById = new Map(structures.map((structure) => [Number(structure.entity_id), structure]));
    return hyperstructures.flatMap((hyperstructure) => {
      const structure = structuresById.get(Number(hyperstructure.hyperstructure_id));
      if (!structure) return [];
      const owner = structure.owner || 0n;
      return [
        {
          access: hyperstructure.access,
          entity_id: hyperstructure.hyperstructure_id,
          hyperstructure,
          isOwner: ContractAddress(owner) === ContractAddress(account.address),
          owner,
          ownerName: getAddressNameFromEntity(hyperstructure.hyperstructure_id, components) ?? "",
          position: { alt: DEFAULT_COORD_ALT, x: structure.base.coord_x, y: structure.base.coord_y },
          structure,
        } as HyperstructureInfo,
      ];
    });
  }, [account.address, components, hyperstructures, structures]);
};
