import { configManager } from "@/dojo/setup";
import { ADMIN_BANK_ENTITY_ID, ID, resources, ResourcesIds, TickIds } from "@bibliothecadao/eternum";
import { Entity, getComponentValue, Has, HasValue, NotValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ResourceManager } from "../../dojo/modelManager/ResourceManager";
import { useDojo } from "../context/DojoContext";

export function getResourceBalance() {
  const dojo = useDojo();
  const tickConfigDefault = configManager.getTick(TickIds.Default);
  const timestamp = Math.floor(Date.now() / 1000);
  const currentDefaultTick = Math.floor(timestamp / Number(tickConfigDefault));

  const getBalance = (entityId: ID, resourceId: ResourcesIds) => {
    const resourceManager = new ResourceManager(dojo.setup, entityId, resourceId);
    return { balance: resourceManager.balance(currentDefaultTick), resourceId };
  };

  return { getBalance };
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
