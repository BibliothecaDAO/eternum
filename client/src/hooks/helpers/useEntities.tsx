import { ClientComponents } from "@/dojo/createClientComponents";
import { getRealmNameById } from "@/ui/utils/realms";
import { divideByPrecision, getEntityIdFromKeys, getPosition } from "@/ui/utils/utils";
import { EntityType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, Has, HasValue, NotValue, getComponentValue } from "@dojoengine/recs";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { useResources } from "./useResources";

export interface PlayerStructures {
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  name: string | undefined;
  entity_id?: bigint | undefined;
  category?: string | undefined;
}

export const useEntities = () => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner, Position, Structure },
    },
  } = useDojo();

  const { getEntityName } = useEntitiesUtils();

  const playerRealms = useEntityQuery([Has(Realm), HasValue(Owner, { address: BigInt(account.address) })]);
  const otherRealms = useEntityQuery([Has(Realm), NotValue(Owner, { address: BigInt(account.address) })]);
  const playerStructures = useEntityQuery([Has(Structure), HasValue(Owner, { address: BigInt(account.address) })]);

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
    playerStructures: (): PlayerStructures[] => {
      return playerStructures
        .map((id) => {
          const structure = getComponentValue(Structure, id);
          const realm = getComponentValue(Realm, id);
          const position = getComponentValue(Position, id);

          const structureName = getEntityName(structure!.entity_id);

          const name = realm
            ? getRealmNameById(realm.realm_id)
            : structureName
              ? `${structure?.category} ${structureName}`
              : structure?.category;
          return { ...structure, position: position!, name };
        })
        .sort((a, b) => (a.category || "").localeCompare(b.category || ""));
    },
  };
};

export const useEntitiesUtils = () => {
  const {
    account: { account },
    setup: {
      components: { EntityName, ArrivalTime, EntityOwner, Movable, Capacity, Position, Army, AddressName, Owner },
    },
  } = useDojo();

  const { getResourcesFromBalance } = useResources();

  const getEntityInfo = (entityId: bigint) => {
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([entityId]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([entityId]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([entityId]));

    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([entityId]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || BigInt("")]));

    const name = getEntityName(entityId);

    const resources = getResourcesFromBalance(entityId);
    const army = getComponentValue(Army, getEntityIdFromKeys([entityId]));
    const rawIntermediateDestination = movable
      ? { x: movable.intermediate_coord_x, y: movable.intermediate_coord_y }
      : undefined;
    const intermediateDestination = rawIntermediateDestination
      ? { x: rawIntermediateDestination.x, y: rawIntermediateDestination.y }
      : undefined;

    const position = getComponentValue(Position, getEntityIdFromKeys([entityId]));

    const homePosition = entityOwner
      ? getComponentValue(Position, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || BigInt(""))]))
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
      isMine: BigInt(owner?.address || "") === BigInt(account.address),
      isRoundTrip: movable?.round_trip || false,
      resources,
      entityType: army ? EntityType.TROOP : EntityType.DONKEY,
      name,
    };
  };

  const getEntityName = (entityId: bigint) => {
    const entityName = getComponentValue(EntityName, getEntityIdFromKeys([entityId]));
    return entityName ? shortString.decodeShortString(entityName.name.toString()) : entityId.toString();
  };

  const getAddressNameFromEntity = (entityId: bigint) => {
    const address = getPlayerAddressFromEntity(entityId);
    if (!address) return;

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));

    return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
  };

  const getPlayerAddressFromEntity = (entityId: bigint) => {
    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([entityId]));
    return entityOwner?.entity_owner_id
      ? getComponentValue(Owner, getEntityIdFromKeys([entityOwner.entity_owner_id]))?.address
      : undefined;
  };

  return { getEntityName, getEntityInfo, getAddressNameFromEntity, getPlayerAddressFromEntity };
};
