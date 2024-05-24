import { Component, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "@/dojo/createClientComponents";
import { unpackResources } from "@/ui/utils/packedData";
import { getRealm, getRealmNameById } from "@/ui/utils/realms";
import { useCaravan } from "./useCaravans";
import { calculateDistance } from "@/ui/utils/utils";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";

export type Structure = ClientComponents["Realm"]["schema"] &
  ClientComponents["Loyalty"]["schema"] & { resources: number[] } & { self: boolean } & { name: string };

export const useStructures = () => {
  const {
    setup: {
      components: { Position, Bank, Realm },
      account: { account },
      systemCalls: { create_hyperstructure },
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

  const createHyperstructure = async (creator_entity_id: bigint, col: number, row: number) => {
    await create_hyperstructure({ signer: account, coords: { x: col, y: row }, creator_entity_id });
  };

  return {
    hasStructures,
    createHyperstructure,
  };
};

export const useStructuresPosition = ({ position }: { position: Position }) => {
  const {
    setup: {
      components: { Position, Bank, Realm, EntityOwner, Owner, Loyalty },
    },
    account: { account },
  } = useDojo();

  const realmsAtPosition = useEntityQuery([HasValue(Position, position), Has(Realm)]);
  const banksAtPosition = useEntityQuery([HasValue(Position, position), Has(Bank)]);

  const formattedRealmAtPosition: Structure = useMemo(() => {
    return realmsAtPosition.map((realm_entity_id: any) => {
      const realm = getComponentValue(Realm as Component, realm_entity_id) as ClientComponents["Realm"]["schema"];
      const entityOwner = getComponentValue(EntityOwner, realm_entity_id);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
      const resources = unpackResources(BigInt(realm?.resource_types_packed || 0n), realm?.resource_types_count || 0);
      const name = getRealmNameById(BigInt(realm?.realm_id) || 0n);
      const loyalty = getComponentValue(Loyalty as Component, realm_entity_id) as ClientComponents["Loyalty"]["schema"];

      return {
        ...realm,
        ...loyalty,
        resources,
        self: owner?.address === BigInt(account.address),
        name,
      };
    });
  }, [realmsAtPosition])[0];

  const formattedBanksAtPosition = useMemo(() => {
    return banksAtPosition.map((bank_entity_id: any) => {
      const bank = getComponentValue(Bank, bank_entity_id);
      return { ...bank };
    });
  }, [banksAtPosition])[0];

  const structuresAtPosition = useMemo(() => {
    return formattedRealmAtPosition?.entity_id != null || formattedBanksAtPosition != null;
  }, [formattedRealmAtPosition, formattedBanksAtPosition]);

  return {
    formattedRealmAtPosition,
    formattedBanksAtPosition,
    structuresAtPosition,
  };
};

// TODO: Make Generic
export function useStructuresFromPosition({ position }: { position: Position }) {
  const {
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const allRealms = useEntityQuery([Has(Realm)]);

  const realms = useMemo(
    () =>
      allRealms.map((entityId) => {
        const realm = getComponentValue(Realm, entityId);
        if (realm) {
          const realmData = getRealm(realm.realm_id);
          if (!realmData) return undefined;
          const name = realmData.name;
          const owner = getComponentValue(Owner, entityId);
          const resources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);

          const distanceFromPosition = calculateDistance(position, realmData.position) ?? 0;

          const timeToTravel = Math.floor(((distanceFromPosition / EternumGlobalConfig.speed.donkey) * 3600) / 60 / 60);

          return {
            ...realm,
            name,
            position: realmData.position,
            owner: owner?.address,
            resources,
            distanceFromPosition,
            timeToTravel,
          };
        }
      }),
    [allRealms],
  );

  return { realms };
}
