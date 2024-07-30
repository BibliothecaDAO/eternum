import { ClientComponents } from "@/dojo/createClientComponents";
import { unpackResources } from "@/ui/utils/packedData";
import { getRealm, getRealmNameById } from "@/ui/utils/realms";
import { calculateDistance } from "@/ui/utils/utils";
import { EternumGlobalConfig, Position, StructureType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "./useArmies";

type Realm = ComponentValue<ClientComponents["Realm"]["schema"]> & {
  resources: number[];
  self: boolean;
  name: string;
  protector: ArmyInfo | undefined;
};

export type Structure = ComponentValue<ClientComponents["Structure"]["schema"]> & {
  isMine: boolean;
  isMercenary: boolean;
  name: string;
  protector: ArmyInfo | undefined;
  owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
  entityOwner: ComponentValue<ClientComponents["EntityOwner"]["schema"]>;
};

const useStructuresPosition = ({ position }: { position: Position }) => {
  const {
    setup: {
      components: { Position, Realm, EntityOwner, Owner, Structure, Protector, EntityName },
    },
    account: { account },
  } = useDojo();

  const { getAliveArmy } = getArmyByEntityId();

  const useFormattedRealmAtPosition = () => {
    const realmsAtPosition = useEntityQuery([
      HasValue(Position, { x: position.x, y: position.y }),
      HasValue(Structure, { category: StructureType[StructureType.Realm] }),
    ]);
    const formattedRealmAtPosition: Realm | undefined = realmsAtPosition.map((realm_entity_id: any) => {
      const realm = getComponentValue(Realm, realm_entity_id);
      if (!realm) return;
      const entityOwner = getComponentValue(EntityOwner, realm_entity_id);
      if (!entityOwner) return;
      const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
      if (!owner) return;
      const resources = unpackResources(BigInt(realm?.resource_types_packed || 0n), realm?.resource_types_count || 0);
      const name = getRealmNameById(BigInt(realm?.realm_id) || 0n);

      const protectorArmy = getComponentValue(Protector, realm_entity_id);
      const protector = protectorArmy ? getAliveArmy(BigInt(protectorArmy.army_id)) : undefined;

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
      const structure = getComponentValue(Structure, entityId);
      if (!structure) {
        return;
      }

      const entityOwner = getComponentValue(EntityOwner, entityId);
      if (!entityOwner) return;
      const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
      if (!owner) return;
      const protectorArmy = getComponentValue(Protector, entityId);
      const protector = protectorArmy ? getAliveArmy(BigInt(protectorArmy.army_id)) : undefined;

      const onChainName = getComponentValue(EntityName, entityId);

      const name = onChainName
        ? shortString.decodeShortString(onChainName.name.toString())
        : `${String(structure.category)
            .replace(/([A-Z])/g, " $1")
            .trim()} ${structure?.entity_id}`;

      return {
        ...structure,
        entityOwner,
        owner,
        name,
        protector: protector as ArmyInfo | undefined,
        isMine: BigInt(owner?.address || 0) === BigInt(account.address),
        isMercenary: owner.address === 0n,
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

export const getStructureAtPosition = ({ x, y }: Position): Structure | undefined => {
  const {
    account: { account },
    setup: {
      components: { Position, Structure, EntityOwner, Owner, Protector, EntityName, Realm },
    },
  } = useDojo();

  const { getAliveArmy } = getArmyByEntityId();

  const structure = useMemo(() => {
    const structureAtPosition = runQuery([HasValue(Position, { x, y }), Has(Structure)]);
    const structureEntityId = Array.from(structureAtPosition)[0];
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: BigInt(0) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getAliveArmy(BigInt(protectorArmy.army_id)) : undefined;

    const onChainName = getComponentValue(EntityName, structureEntityId);

    const name =
      structure.category === StructureType[StructureType.Realm]
        ? getRealmNameById(getComponentValue(Realm, structureEntityId)!.realm_id)
        : onChainName
        ? shortString.decodeShortString(onChainName.name.toString())
        : `${String(structure.category)
            .replace(/([A-Z])/g, " $1")
            .trim()} ${structure?.entity_id}`;

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      protector,
      isMine: BigInt(owner?.address || 0) === BigInt(account.address),
      isMercenary: owner.address === 0n,
    };
  }, [x, y]);

  return structure;
};

export const getStructureByPosition = () => {
  const {
    account: { account },
    setup: {
      components: { Position, Structure, EntityOwner, Owner, Protector, EntityName, Realm },
    },
  } = useDojo();

  const { getAliveArmy } = getArmyByEntityId();

  const structureAtPosition = ({ x, y }: Position) => {
    const structureAtPosition = runQuery([HasValue(Position, { x, y }), Has(Structure)]);
    const structureEntityId = Array.from(structureAtPosition)[0];
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: BigInt(0) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getAliveArmy(BigInt(protectorArmy.army_id)) : undefined;

    const onChainName = getComponentValue(EntityName, structureEntityId);

    const name =
      structure.category === StructureType[StructureType.Realm]
        ? getRealmNameById(getComponentValue(Realm, structureEntityId)!.realm_id)
        : onChainName
        ? shortString.decodeShortString(onChainName.name.toString())
        : `${String(structure.category)
            .replace(/([A-Z])/g, " $1")
            .trim()} ${structure?.entity_id}`;

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      protector,
      isMine: BigInt(owner?.address || 0) === BigInt(account.address),
      isMercenary: owner.address === 0n,
    };
  };

  return structureAtPosition;
};

export const getStructureByEntityId = (entityId: bigint) => {
  const {
    account: { account },
    setup: {
      components: { Structure, EntityOwner, Owner, Protector, EntityName, Realm },
    },
  } = useDojo();

  const { getAliveArmy } = getArmyByEntityId();

  const structure = useMemo(() => {
    const structureEntityId = getEntityIdFromKeys([entityId]);
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: BigInt(0) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getAliveArmy(BigInt(protectorArmy.army_id)) : undefined;

    const onChainName = getComponentValue(EntityName, structureEntityId);

    const name =
      structure.category === StructureType[StructureType.Realm]
        ? getRealmNameById(getComponentValue(Realm, structureEntityId)!.realm_id)
        : onChainName
        ? shortString.decodeShortString(onChainName.name.toString())
        : `${String(structure.category)
            .replace(/([A-Z])/g, " $1")
            .trim()} ${structure?.entity_id}`;

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      protector,
      isMine: BigInt(owner?.address || 0) === BigInt(account.address),
      isMercenary: owner.address === 0n,
    };
  }, [entityId]);

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
