import { Has, HasValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";

export const useStructures = () => {
  const {
    setup: {
      components: { Position, Bank, Realm },
    },
  } = useDojo();

  // to do: change that when more generalised structure component is added

  const hasStructures = (col: number, row: number) => {
    const bankEntities = runQuery([HasValue(Position, { x: BigInt(col), y: BigInt(row) }), Has(Bank)]);
    const realmEntities = runQuery([HasValue(Position, { x: BigInt(col), y: BigInt(row) }), Has(Realm)]);
    // add settlement
    // add hyperstructure
    return Array.from(bankEntities).length > 0 || Array.from(realmEntities).length > 0;
  };

  return {
    hasStructures,
  };
};
