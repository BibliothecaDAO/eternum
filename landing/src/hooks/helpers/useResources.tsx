import { configManager } from "@/dojo/setup";
import { ADMIN_BANK_ENTITY_ID, ID, resources, ResourcesIds, TickIds } from "@bibliothecadao/eternum";
import { Entity, getComponentValue, Has, HasValue, NotValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useQuery } from "@tanstack/react-query";
import { ResourceManager } from "../../dojo/modelManager/ResourceManager";
import { useDojo } from "../context/DojoContext";
import { execute } from "../gql/execute";
import { GET_ENTITY_RESOURCES } from "../query/resources";

export function useResourceBalance({ entityId, resourceId }: { entityId?: ID; resourceId?: ResourcesIds }) {
  const { data, isLoading } = useQuery({
    queryKey: ["entityResources", entityId],
    queryFn: () => (entityId ? execute(GET_ENTITY_RESOURCES, { entityId, resourceType: resourceId }) : null),
    refetchInterval: 10_000,
  });

  const getBalance = (resourceId: ResourcesIds) => {
    return data?.s0EternumResourceModels?.edges?.find((r) => r?.node?.resource_type === resourceId)?.node?.balance ?? 0;
  };

  return { data: data?.s0EternumResourceModels?.edges, isLoading, getBalance };
}

export function useDonkeyArrivals() {
  const {
    setup: {
      components: { Position, EntityOwner, ArrivalTime, OwnedResourcesTracker, Weight },
    },
  } = useDojo();
  const dojo = useDojo();

  const getOwnerArrivalsAtBank = (realmEntityIds: ID[]) => {
    const bankPosition = getComponentValue(Position, getEntityIdFromKeys([BigInt(ADMIN_BANK_ENTITY_ID)]));

    const arrivals: any[] = [];
    for (const realmEntityId of realmEntityIds) {
      const res = runQuery([
        HasValue(Position, { x: bankPosition?.x ?? 0, y: bankPosition?.y ?? 0 }),
        NotValue(OwnedResourcesTracker, { resource_types: 0n }),
        Has(OwnedResourcesTracker),
        Has(Weight),
        Has(ArrivalTime),
        HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      ]);

      arrivals.push(...res);
    }

    return arrivals;
  };

  const getDonkeyInfo = (donkeyEntity: Entity) => {
    const tickConfigDefault = configManager.getTick(TickIds.Default);
    const timestamp = Math.floor(Date.now() / 1000);
    const currentDefaultTick = Math.floor(timestamp / Number(tickConfigDefault));

    const donkeyArrivalTime = getComponentValue(ArrivalTime, donkeyEntity)?.arrives_at;
    const donkeyEntityId = getComponentValue(EntityOwner, donkeyEntity)?.entity_id;
    const donkeyResources = resources
      .map((r) => r.id)
      .map((id) => {
        const resourceManager = new ResourceManager(dojo.setup, donkeyEntityId as number, id);
        const balance = resourceManager.balance(currentDefaultTick);
        return { resourceId: id, amount: balance };
      })
      .filter((r) => r.amount > 0);
    return { donkeyArrivalTime, donkeyEntityId, donkeyResources };
  };

  return { getOwnerArrivalsAtBank, getDonkeyInfo };
}
