import { StructureType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@dojoengine/recs";
import { useDojo } from "./context/DojoContext";

export const useStructuresNumber = () => {
  const {
    setup: {
      components: { Hyperstructure, Realm, Structure },
    },
  } = useDojo();

  const fragmentMinesCount = useEntityQuery([
    HasValue(Structure, { category: StructureType[StructureType.FragmentMine] }),
  ]).length;

  const hyperstructuresCount = useEntityQuery([Has(Hyperstructure)]).length;
  const realmsCount = useEntityQuery([Has(Realm)]).length;

  return { fragmentMinesCount, hyperstructuresCount, realmsCount };
};
