import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "@/dojo/createClientComponents";
import { unpackResources } from "@/ui/utils/packedData";
import { getRealmNameById } from "@/ui/utils/realms";

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
      components: { Position, Bank, Realm, EntityOwner, Owner },
    },
    account: { account },
  } = useDojo();

  const realmsAtPosition = useEntityQuery([HasValue(Position, position), Has(Realm)]);
  const banksAtPosition = useEntityQuery([HasValue(Position, position), Has(Bank)]);

  const formattedRealmsAtPosition = useMemo(() => {
    return realmsAtPosition.map((realm_entity_id: any) => {
      const realm = getComponentValue(Realm, realm_entity_id) as any;
      const entityOwner = getComponentValue(EntityOwner, realm_entity_id);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));

      const resources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);

      const name = getRealmNameById(realm.realm_id);

      return { ...realm, resources, self: owner?.address === BigInt(account.address), name };
    });
  }, [realmsAtPosition]);

  const formattedBanksAtPosition = useMemo(() => {
    return banksAtPosition.map((bank_entity_id: any) => {
      const bank = getComponentValue(Bank, bank_entity_id);
      return { ...bank };
    });
  }, [banksAtPosition]);

  const structuresAtPosition = useMemo(() => {
    return formattedRealmsAtPosition.length > 0 || formattedBanksAtPosition.length > 0;
  }, [formattedRealmsAtPosition, formattedBanksAtPosition]);

  return {
    formattedRealmsAtPosition,
    formattedBanksAtPosition,
    structuresAtPosition,
  };
};
