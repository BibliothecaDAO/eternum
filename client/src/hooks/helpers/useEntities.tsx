import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { divideByPrecision, getEntityIdFromKeys, getPosition, numberToHex } from "@/ui/utils/utils";
import { getRealmNameById } from "@/ui/utils/realms";
import { hexToAscii } from "@dojoengine/utils";
import { useResources } from "./useResources";
import { ENTITY_TYPE, EntityInterface } from "@bibliothecadao/eternum";

export const useEntities = () => {
  const {
    account: { account },
    setup: {
      components: {
        Realm,
        Owner,
        BankAccounts,
        EntityName,
        ArrivalTime,
        EntityOwner,
        Movable,
        Capacity,
        OwnedResourcesTracker,
        Position,
        Army,
      },
    },
  } = useDojo();

  const { getResourcesFromBalance } = useResources();

  const playerRealms = useEntityQuery([Has(Realm), HasValue(Owner, { address: BigInt(account.address) })]);

  const getEntityName = (entityId: bigint) => {
    const entityName = getComponentValue(EntityName, getEntityIdFromKeys([entityId]));
    return entityName ? hexToAscii(numberToHex(Number(entityName.name))) : undefined;
  };

  const getEntityInfo = (entityId: bigint): EntityInterface => {
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([entityId]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([entityId]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([entityId]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([entityId]));
    const resources = getResourcesFromBalance(entityId);
    const army = getComponentValue(Army, getEntityIdFromKeys([entityId]));
    const rawIntermediateDestination = movable
      ? { x: movable.intermediate_coord_x, y: movable.intermediate_coord_y }
      : undefined;
    const intermediateDestination = rawIntermediateDestination
      ? { x: rawIntermediateDestination.x, y: rawIntermediateDestination.y }
      : undefined;

    const position = getComponentValue(Position, getEntityIdFromKeys([entityId]));

    const ownerEntity = getComponentValue(EntityOwner, getEntityIdFromKeys([entityId]))?.entity_owner_id;
    const homePosition = ownerEntity
      ? getComponentValue(Position, getEntityIdFromKeys([BigInt(ownerEntity)]))
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
      isMine: owner?.address === BigInt(account.address),
      isRoundTrip: movable?.round_trip || false,
      resources,
      entityType: army ? ENTITY_TYPE.TROOP : ENTITY_TYPE.DONKEY,
    };
  };

  const playerAccounts = useEntityQuery([HasValue(BankAccounts, { owner: BigInt(account.address) })]);

  return {
    playerRealms: () => {
      return playerRealms.map((id) => {
        const realm = getComponentValue(Realm, id);
        return { ...realm, position: getPosition(realm!.realm_id), name: getRealmNameById(realm!.realm_id) };
      });
    },
    playerAccounts: () => {
      return playerAccounts.map((id) => {
        const account = getComponentValue(BankAccounts, id);
        return { entity_id: account?.entity_id, name: `Bank ${account?.bank_entity_id.toString()}` };
      });
    },
    getEntityName,
    getEntityInfo,
  };
};
