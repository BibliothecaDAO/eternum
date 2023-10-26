import { EntityIndex, Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { IncomingOrderInterface } from "../graphql/useGraphQLQueries";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { BigNumberish } from "starknet";
import { Resource } from "../../types";

export function useIncomingOrders() {
  const {
    account: { account },
    setup: {
      components: { ArrivalTime, Position, Trade, Inventory, ForeignKey, ResourcesChest, ResourceDetached },
      optimisticSystemCalls: { optimisticEmptyResourcesChest },
      systemCalls: { empty_resources_chest },
    },
  } = useDojo();

  const getIncomingOrderInfo = (realmEntityId: number, tradeId: EntityIndex): IncomingOrderInterface => {
    let trade = getComponentValue(Trade, tradeId);
    let isMaker = trade ? trade.maker_id === realmEntityId : undefined;
    // if is maker, to get origin, get the position of the taker
    // if is taker, to get origin, get the position of the maker
    let origin: { x: number; y: number } | undefined;
    let position: { x: number; y: number } | undefined;
    let arrivalTime: { arrives_at: number } | undefined;
    if (isMaker) {
      origin = trade ? getComponentValue(Position, getEntityIdFromKeys([BigInt(trade.taker_id)])) : undefined;
      position = trade
        ? getComponentValue(Position, getEntityIdFromKeys([BigInt(trade.maker_transport_id)]))
        : undefined;
      arrivalTime = trade
        ? getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(trade.maker_transport_id)]))
        : undefined;
    } else {
      origin = trade ? getComponentValue(Position, getEntityIdFromKeys([BigInt(trade.maker_id)])) : undefined;
      position = trade
        ? getComponentValue(Position, getEntityIdFromKeys([BigInt(trade.taker_transport_id)]))
        : undefined;
      arrivalTime = trade
        ? getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(trade.taker_transport_id)]))
        : undefined;
    }
    return {
      claimed: false,
      tradeId,
      arrivalTime: arrivalTime?.arrives_at,
      origin,
      position,
    };
  };

  // for any entity that has a resourceChest in its inventory,
  const getResourcesChestFromInventory = (entityId: number): Resource[] => {
    let inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(entityId)]));
    let foreignKey = inventory
      ? getComponentValue(ForeignKey, getEntityIdFromKeys([BigInt(inventory.key), BigInt(0)]))
      : undefined;
    let resourcesChest = foreignKey
      ? getComponentValue(ResourcesChest, getEntityIdFromKeys([BigInt(foreignKey.entity_id)]))
      : undefined;

    if (!resourcesChest) return [];
    let resources: Resource[] = [];
    let { resources_count } = resourcesChest;
    for (let i = 0; i < resources_count; i++) {
      let entityId = getEntityIdFromKeys([BigInt(foreignKey.entity_id), BigInt(i)]);
      const resource = getComponentValue(ResourceDetached, entityId);
      if (resource) {
        resources.push({
          resourceId: resource.resource_type,
          amount: resource.resource_amount,
        });
      }
    }
    return resources;
  };

  /* Claim Order
   * @param entity_id: entity id of realm
   * @param trade_id: id of the trade
   * @param [optimisticResourcesGet]: resources to display in case of optimistic rendering
   * @returns: void
   */
  const emptyResourceChest = async (
    receiver_id: BigNumberish,
    carrier_id: BigNumberish,
    resources_chest_id: BigNumberish,
    optimisticResourcesGet?: Resource[],
  ) => {
    if (optimisticResourcesGet) {
      return await optimisticEmptyResourcesChest(
        optimisticResourcesGet,
        empty_resources_chest,
      )({
        signer: account,
        receiver_id,
        carrier_id,
        resources_chest_id,
      });
    }
    return await empty_resources_chest({
      signer: account,
      receiver_id,
      carrier_id,
      resources_chest_id,
    });
  };

  return { getIncomingOrderInfo, getResourcesChestFromInventory, emptyResourceChest };
}

// incoming orders are caravans coming your way with a resource chest in their inventory
export function useGetCaravansWithResourcesChest() {
  const {
    setup: {
      components: { Position, CaravanMembers, Inventory },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();
  const realmPosition = getComponentValue(Position, getEntityIdFromKeys([BigInt(realmEntityId)]));

  // const [incomingOrders, setIncomingOrders] = useState<IncomingOrderInterface[]>([]);
  // const [entityIds, setEntityIds] = useState<EntityIndex[]>([]);

  // const { getIncomingOrderInfo } = useIncomingOrders();

  // const set1 = useEntityQuery([
  //   HasValue(Trade, {
  //     taker_id: realmEntityId,
  //     claimed_by_taker: 0 as any,
  //   }),
  //   // accepted
  //   HasValue(Status, { value: 1 }),
  // ]);
  // const set2 = useEntityQuery([
  //   HasValue(Trade, {
  //     maker_id: realmEntityId,
  //     claimed_by_maker: 0 as any,
  //   }),
  //   // accepted
  //   HasValue(Status, { value: 1 }),
  // ]);

  const caravansAtPositionWithInventory = useEntityQuery([
    Has(CaravanMembers),
    HasValue(Inventory, {
      count: 1,
    }),
    HasValue(Position, {
      x: realmPosition?.x,
      y: realmPosition?.y,
    }),
  ]);

  // useMemo((): any => {
  //   const incomingOrders = entityIds
  //     .map((id) => {
  //       return getIncomingOrderInfo(realmEntityId, id);
  //     })
  //     .filter(Boolean)
  //     .filter((order) => order.position?.x === realmPosition?.x || order.position?.y === realmPosition?.y)
  //     // TODO: manage sorting here
  //     .sort((a, b) => b!.tradeId - a!.tradeId) as IncomingOrderInterface[];
  //   setIncomingOrders(incomingOrders);
  //   // only recompute when different number of orders
  // }, [entityIds.length]);

  return {
    caravansAtPositionWithInventory,
  };
}
