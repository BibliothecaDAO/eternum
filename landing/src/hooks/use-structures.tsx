import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useDojo } from "./context/DojoContext";

export const useStructuresNumber = () => {
  const {
    setup: {
      components: {
        Hyperstructure,
        Realm,
        events: { FragmentMineDiscovered },
      },
    },
  } = useDojo();

  const fragmentMinesCount = useEntityQuery([Has(FragmentMineDiscovered)]).length;
  const hyperstructuresCount = useEntityQuery([Has(Hyperstructure)]).length;
  const realmsCount = useEntityQuery([Has(Realm)]).length;

  return { fragmentMinesCount, hyperstructuresCount, realmsCount };
};
