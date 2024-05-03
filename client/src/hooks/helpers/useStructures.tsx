import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "@/dojo/createClientComponents";

export const useStructures = () => {
  const {
    setup: {
      components: { Position, Bank, Realm },
    },
  } = useDojo();

  // to do: change that when more generalised structure component is added

  const hasStructures = (col: number, row: number) => {
    const bankEntities = runQuery([HasValue(Position, { x: col, y: row }), Has(Bank)]);
    const realmEntities = runQuery([HasValue(Position, { x: col, y: row }), Has(Realm)]);
    // add settlement
    // add hyperstructure
    return Array.from(bankEntities).length > 0 || Array.from(realmEntities).length > 0;
  };

  return {
    hasStructures,
  };
};

export const useStructuresPosition = ({ position }: { position: Position }) => {
  const {
    setup: {
      components: { Position, Bank, Realm },
    },
  } = useDojo();

  const realmsAtPosition = useEntityQuery([HasValue(Position, position), Has(Realm)]);
  const banksAtPosition = useEntityQuery([HasValue(Position, position), Has(Bank)]);

  const formattedRealmsAtPosition = useMemo(() => {
    return realmsAtPosition.map((realm_entity_id: any) => {
      const realm = getComponentValue(Realm, realm_entity_id) as any;
      return realm;
    });
  }, [realmsAtPosition]);

  const formattedBanksAtPosition = useMemo(() => {
    return banksAtPosition.map((bank_entity_id: any) => {
      const bank = getComponentValue(Bank, bank_entity_id);
      return { ...bank };
    });
  }, [banksAtPosition]);

  return {
    formattedRealmsAtPosition,
    formattedBanksAtPosition,
  };
};
