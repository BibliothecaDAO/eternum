import { ClientComponents } from "@/dojo/createClientComponents";
import { getRealmNameById } from "@/ui/utils/realms";
import { divideByPrecision, getEntityIdFromKeys, getPosition } from "@/ui/utils/utils";
import { ContractAddress, EntityType, ID } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import {
  Component,
  ComponentValue,
  Entity,
  Has,
  HasValue,
  NotValue,
  getComponentValue,
  runQuery,
} from "@dojoengine/recs";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { getResourcesUtils } from "./useResources";

export type PlayerStructure = ComponentValue<ClientComponents["Structure"]["schema"]> & {
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  name: string;
  category?: string | undefined;
};

export const useEntities = () => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner, Position, Structure },
    },
  } = useDojo();

  const { getEntityName } = getEntitiesUtils();

  const playerRealms = useEntityQuery([Has(Realm), HasValue(Owner, { address: ContractAddress(account.address) })]);
  const otherRealms = useEntityQuery([Has(Realm), NotValue(Owner, { address: ContractAddress(account.address) })]);
  const playerStructures = useEntityQuery([
    Has(Structure),
    HasValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  return {
    playerRealms: () => {
      return playerRealms.map((id) => {
        const realm = getComponentValue(Realm, id);
        return { ...realm, position: getPosition(realm!.realm_id), name: getRealmNameById(realm!.realm_id) };
      });
    },
    otherRealms: () => {
      return otherRealms.map((id) => {
        const realm = getComponentValue(Realm, id);
        return { ...realm, position: getPosition(realm!.realm_id), name: getRealmNameById(realm!.realm_id) };
      });
    },
    playerStructures: (): PlayerStructure[] => {
      return playerStructures
        .map((id) => {
          const structure = getComponentValue(Structure, id);
          if (!structure) return;

          const realm = getComponentValue(Realm, id);
          const position = getComponentValue(Position, id);

          const structureName = getEntityName(structure!.entity_id);

          const name = realm
            ? getRealmNameById(realm.realm_id)
            : structureName
              ? `${structure?.category} ${structureName}`
              : structure.category || "";
          return { ...structure, position: position!, name };
        })
        .filter((structure): structure is PlayerStructure => structure !== undefined)
        .sort((a, b) => (b.category || "").localeCompare(a.category || ""));
    },
  };
};

export const getEntitiesUtils = () => {
  const {
    account: { account },
    setup: {
      components: { EntityName, ArrivalTime, EntityOwner, Movable, Capacity, Position, Army, AddressName, Owner },
    },
  } = useDojo();

  const { getResourcesFromBalance } = getResourcesUtils();

  const getEntityInfo = (entityId: ID) => {
    const entityIdBigInt = BigInt(entityId);
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([entityIdBigInt]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([entityIdBigInt]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([entityIdBigInt]));

    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([entityIdBigInt]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));

    const name = getEntityName(entityId);

    const resources = getResourcesFromBalance(entityId);
    const army = getComponentValue(Army, getEntityIdFromKeys([entityIdBigInt]));
    const rawIntermediateDestination = movable
      ? { x: movable.intermediate_coord_x, y: movable.intermediate_coord_y }
      : undefined;
    const intermediateDestination = rawIntermediateDestination
      ? { x: rawIntermediateDestination.x, y: rawIntermediateDestination.y }
      : undefined;

    const position = getComponentValue(Position, getEntityIdFromKeys([entityIdBigInt]));

    const homePosition = entityOwner
      ? getComponentValue(Position, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]))
      : undefined;

    return {
      entityId,
      arrivalTime: arrivalTime?.arrives_at,
      blocked: Boolean(movable?.blocked),
      capacity: divideByPrecision(Number(capacity?.weight_gram) || 0),
      intermediateDestination,
      position: position ? { x: position.x, y: position.y } : undefined,
      homePosition: homePosition ? { x: homePosition.x, y: homePosition.y } : undefined,
      owner: owner?.address,
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isRoundTrip: movable?.round_trip || false,
      resources,
      entityType: army ? EntityType.TROOP : EntityType.DONKEY,
      name,
    };
  };

  const getEntityName = (entityId: ID) => {
    const entityName = getComponentValue(EntityName, getEntityIdFromKeys([BigInt(entityId)]));
    return entityName ? shortString.decodeShortString(entityName.name.toString()) : entityId.toString();
  };

  const getAddressNameFromEntity = (entityId: ID) => {
    const address = getPlayerAddressFromEntity(entityId);
    if (!address) return;

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));

    return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
  };

  const getPlayerAddressFromEntity = (entityId: ID) => {
    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([BigInt(entityId)]));
    return entityOwner?.entity_owner_id
      ? getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))?.address
      : undefined;
  };

  return { getEntityName, getEntityInfo, getAddressNameFromEntity, getPlayerAddressFromEntity };
};

export const useGetAllPlayers = () => {
  const {
    setup: {
      components: { Owner, Realm },
    },
  } = useDojo();

  const playersEntityIds = runQuery([Has(Owner), Has(Realm)]);
  const { getAddressNameFromEntity } = getEntitiesUtils();

  const getPlayers = () => {
    return getAddressNameFromEntityIds(Array.from(playersEntityIds), Owner, getAddressNameFromEntity);
  };

  return getPlayers;
};

export const getAddressNameFromEntityIds = (
  entityId: Array<Entity>,
  Owner: Component<ClientComponents["Owner"]["schema"]>,
  getAddressNameFromEntity: (entityId: ID) => string | undefined,
) => {
  return Array.from(entityId)
    .map((id) => {
      const owner = getComponentValue(Owner, id);
      if (!owner) return;

      const addressName = getAddressNameFromEntity(owner?.entity_id);
      return { ...owner, addressName };
    })
    .filter(
      (owner): owner is ComponentValue<ClientComponents["Owner"]["schema"]> & { addressName: string | undefined } =>
        owner !== undefined,
    );
};
