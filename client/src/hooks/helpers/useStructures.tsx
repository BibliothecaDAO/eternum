import { ClientComponents } from "@/dojo/createClientComponents";
import { unpackResources } from "@/ui/utils/packedData";
import { getRealm, getRealmNameById } from "@/ui/utils/realms";
import { calculateDistance, currentTickCount } from "@/ui/utils/utils";
import { ContractAddress, EternumGlobalConfig, ID, Position, StructureType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "./useArmies";
import { getEntitiesUtils } from "./useEntities";

export type Structure = ComponentValue<ClientComponents["Structure"]["schema"]> & {
  isMine: boolean;
  isMercenary: boolean;
  name: string;
  protector: ArmyInfo | undefined;
  owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
  entityOwner: ComponentValue<ClientComponents["EntityOwner"]["schema"]>;
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

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getAliveArmy(protectorArmy.army_id) : undefined;

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
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
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

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getAliveArmy(protectorArmy.army_id) : undefined;

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
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isMercenary: owner.address === 0n,
    };
  };

  return structureAtPosition;
};

export const getStructureByEntityId = (entityId: ID) => {
  const {
    account: { account },
    setup: {
      components: { Structure, EntityOwner, Owner, Protector, EntityName, Realm, Position, AddressName },
    },
  } = useDojo();

  const { getAliveArmy } = getArmyByEntityId();

  const structure = useMemo(() => {
    const structureEntityId = getEntityIdFromKeys([BigInt(entityId)]);
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getAliveArmy(protectorArmy.army_id) : undefined;

    const onChainName = getComponentValue(EntityName, structureEntityId);

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([owner?.address]));
    const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : "Bandits";

    const name =
      structure.category === StructureType[StructureType.Realm]
        ? getRealmNameById(getComponentValue(Realm, structureEntityId)!.realm_id)
        : onChainName
          ? shortString.decodeShortString(onChainName.name.toString())
          : `${String(structure.category)
              .replace(/([A-Z])/g, " $1")
              .trim()} ${structure?.entity_id}`;

    const position = getComponentValue(Position, structureEntityId);

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      position,
      protector,
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isMercenary: owner.address === 0n,
      ownerName,
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

export const getStructuresOfOtherPlayers = () => {
  const {
    account: { account },
    setup: {
      components: { Owner, Structure },
    },
  } = useDojo();

  const { getEntityName, getAddressNameFromEntity } = getEntitiesUtils();

  const structures = useMemo(() => {
    const structuresEntities = runQuery([
      Has(Structure),
      NotValue(Owner, { address: ContractAddress(account.address) }),
    ]);

    return Array.from(structuresEntities).map((entityId) => {
      const structure = getComponentValue(Structure, entityId);
      if (!structure) return undefined;

      const structureName = getEntityName(structure.entity_id);
      const playerName = getAddressNameFromEntity(structure.entity_id);
      return {
        structureName,
        playerName,
      };
    });
  }, [account.address]);

  return structures;
};

export const isStructureImmune = (created_at: number, currentTimestamp: number): boolean => {
  const tickCount = currentTickCount(currentTimestamp);
  const allowAttackTick = currentTickCount(created_at) + EternumGlobalConfig.battle.graceTickCount;

  if (tickCount < allowAttackTick) {
    return true;
  }
  return false;
};
