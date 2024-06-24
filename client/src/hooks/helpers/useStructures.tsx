import { ClientComponents } from "@/dojo/createClientComponents";
import { unpackResources } from "@/ui/utils/packedData";
import { getRealm, getRealmNameById } from "@/ui/utils/realms";
import { calculateDistance } from "@/ui/utils/utils";
import { EternumGlobalConfig, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Component, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "./useArmies";

export type Realm = ClientComponents["Realm"]["schema"] & {
  resources: number[];
  self: boolean;
  name: string;
  protector: ArmyInfo | undefined;
};

export type Structure = ClientComponents["Structure"]["schema"] & {
  isMine: boolean;
  name: string;
  protector: ArmyInfo | undefined;
  owner: ClientComponents["Owner"]["schema"];
  entityOwner: ClientComponents["EntityOwner"]["schema"];
};

export type FullStructure = ClientComponents["Structure"]["schema"] & {
  entityOwner: ClientComponents["EntityOwner"]["schema"];
  owner: ClientComponents["Owner"]["schema"];
  protector: ArmyInfo | undefined;
  isMine: boolean;
};

export const useStructuresPosition = ({ position }: { position: Position }) => {
  const {
    setup: {
      components: { Position, Realm, EntityOwner, Owner, Structure, Protector, EntityName },
    },
    account: { account },
  } = useDojo();

  const { getArmy } = getArmyByEntityId();

  const useFormattedRealmAtPosition = () => {
    const realmsAtPosition = useEntityQuery([HasValue(Position, position), HasValue(Structure, { category: "Realm" })]);
    const formattedRealmAtPosition: Realm = realmsAtPosition.map((realm_entity_id: any) => {
      const realm = getComponentValue(Realm as Component, realm_entity_id) as ClientComponents["Realm"]["schema"];
      const entityOwner = getComponentValue(EntityOwner, realm_entity_id);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
      const resources = unpackResources(BigInt(realm?.resource_types_packed || 0n), realm?.resource_types_count || 0);
      const name = getRealmNameById(BigInt(realm?.realm_id) || 0n);

      let protector: ClientComponents["Protector"]["schema"] | undefined | ArmyInfo = getComponentValue(
        Protector,
        realm_entity_id,
      ) as unknown as ClientComponents["Protector"]["schema"];
      protector = protector ? getArmy(BigInt(protector.army_id)) : undefined;

      const fullRealm = {
        ...realm,
        protector: protector as ArmyInfo | undefined,
        resources,
        self: owner?.address === BigInt(account.address),
        name: name,
      };
      return fullRealm;
    })[0];

    return formattedRealmAtPosition;
  };

  const useFormattedStructureAtPosition = () => {
    // structures at position
    const structuresAtPosition = useEntityQuery([HasValue(Position, position), Has(Structure)]);

    const formattedStructureAtPosition: Structure | undefined = structuresAtPosition.map((entityId: any) => {
      const structure = getComponentValue(Structure, entityId) as unknown as ClientComponents["Structure"]["schema"];
      if (!structure) {
        return;
      }

      const entityOwner = getComponentValue(
        EntityOwner,
        entityId,
      ) as unknown as ClientComponents["EntityOwner"]["schema"];
      const owner = getComponentValue(
        Owner,
        getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id) || 0n]),
      ) as unknown as ClientComponents["Owner"]["schema"];
      let protector: ClientComponents["Protector"]["schema"] | undefined | ArmyInfo = getComponentValue(
        Protector,
        entityId,
      ) as unknown as ClientComponents["Protector"]["schema"];
      protector = protector ? getArmy(BigInt(protector.army_id)) : undefined;

      const onChainName = getComponentValue(EntityName, entityId);

      const name = onChainName
        ? shortString.decodeShortString(onChainName.name.toString())
        : `${structure.category} ${structure?.entity_id}`;

      return {
        ...structure,
        entityOwner,
        owner,
        name,
        protector: protector as ArmyInfo | undefined,
        isMine: BigInt(owner!.address) === BigInt(account.address),
      };
    })[0];

    return formattedStructureAtPosition;
  };

  const hasStructuresAtPosition = () => {
    return useEntityQuery([HasValue(Position, position), Has(Structure)]).length > 0;
  };

  return {
    useFormattedRealmAtPosition,
    useFormattedStructureAtPosition,
    hasStructuresAtPosition,
  };
};

export const getStructureAtPosition = (position: Position) => {
  const {
    account: { account },
    setup: {
      components: { Position, Structure, EntityOwner, Owner, Protector, EntityName, Realm },
    },
  } = useDojo();

  const { getArmy } = getArmyByEntityId();

  const structure = useMemo(() => {
    const structureAtPosition = runQuery([HasValue(Position, position), Has(Structure)]);

    const structureEntityId = Array.from(structureAtPosition)[0];
    const structure = getComponentValue(
      Structure,
      structureEntityId,
    ) as unknown as ClientComponents["Structure"]["schema"];
    if (!structure) {
      return;
    }

    const entityOwner = getComponentValue(
      EntityOwner,
      structureEntityId,
    ) as unknown as ClientComponents["EntityOwner"]["schema"];
    const owner = getComponentValue(
      Owner,
      getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id) || 0n]),
    ) as unknown as ClientComponents["Owner"]["schema"];

    let protector: ClientComponents["Protector"]["schema"] | undefined | ArmyInfo = getComponentValue(
      Protector,
      structureEntityId,
    ) as unknown as ClientComponents["Protector"]["schema"];
    protector = protector ? getArmy(BigInt(protector.army_id)) : undefined;

    const onChainName = getComponentValue(EntityName, structureEntityId);

    const name =
      String(structure.category) === "Realm"
        ? getRealmNameById(getComponentValue(Realm, structureEntityId)!.realm_id)
        : onChainName
        ? shortString.decodeShortString(onChainName.name.toString())
        : `${structure.category} ${structure?.entity_id}`;

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      protector: protector as ArmyInfo | undefined,
      isMine: BigInt(owner!.address) === BigInt(account.address),
    };
  }, [position]);

  return structure;
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
