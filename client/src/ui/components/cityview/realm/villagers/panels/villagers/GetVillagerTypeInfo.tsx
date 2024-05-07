import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../../utils/realms";
import { formatSecondsLeftInDaysHours } from "../../../labor/laborUtils";
import { OrderIcon } from "../../../../../../elements/OrderIcon";
import { Npc, Villager, VillagerType } from "../../types";
import { useDojo } from "@/hooks/context/DojoContext";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";

export function getVillagerTypeInfo(villager: Villager) {
  const {
    setup: {
      components: { ArrivalTime, EntityOwner, Realm, Position },
    },
  } = useDojo();

  const { nextBlockTimestamp } = useBlockchainStore();

  const getInfoByType = () => {
    switch (villager.type) {
      case VillagerType.Traveler:
        return getNpcTravelInfo(villager.npc);
      case VillagerType.Resident:
        return getNpcResidencyInfo(villager.npc, villager.native);
      case VillagerType.AtGates:
        return getNpcGatesInfo(villager.npc);
      default:
        return <></>;
    }
  };

  const getNpcGatesInfo = (npc: Npc) => {
    const npcOriginRealmEntity = runQuery([HasValue(EntityOwner, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcOriginRealm = getComponentValue(EntityOwner, npcOriginRealmEntity.values().next().value);

    const realmEntity = runQuery([HasValue(Realm, { entity_id: BigInt(npcOriginRealm!.entity_owner_id.toString()) })]);
    const realmId = getComponentValue(Realm, realmEntity.values().next().value);
    const orderName = getRealmOrderNameById(realmId!.realm_id);
    const realmName = getRealmNameById(realmId!.realm_id);

    let timeLeftForTravelOrSpentInRealm = "";

    const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTime, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);

    timeLeftForTravelOrSpentInRealm = formatSecondsLeftInDaysHours(nextBlockTimestamp! - npcArrivalTime!.arrives_at);

    return (
      <>
        <div className="flex items-center ml-2 -mt-2 italic">
          <span>From:</span>
          <OrderIcon className="mx-1" order={orderName} size="xs" />
          <span className="text-gold">{realmName}</span>
        </div>

        <div className="flex ml-auto -mt-2 italic">
          <span>Has been there for: </span> <span className="ml-1 text-gold">{timeLeftForTravelOrSpentInRealm}</span>
        </div>
      </>
    );
  };

  const getNpcResidencyInfo = (npc: Npc, native: boolean) => {
    const npcOriginRealmEntity = runQuery([HasValue(EntityOwner, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcOriginRealm = getComponentValue(EntityOwner, npcOriginRealmEntity.values().next().value);

    let orderName = "";
    let realmName = "";
    if (npcOriginRealm) {
      const realmEntity = runQuery([
        HasValue(Realm, { entity_id: BigInt(npcOriginRealm!.entity_owner_id.toString()) }),
      ]);
      const realmId = getComponentValue(Realm, realmEntity.values().next().value);
      orderName = getRealmOrderNameById(realmId!.realm_id);
      realmName = getRealmNameById(realmId!.realm_id);
    }

    let timeLeftForTravelOrSpentInRealm = "";
    if (!native) {
      const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTime, { entity_id: BigInt(npc.entityId.toString()) })]);
      const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);

      if (npcArrivalTime) {
        timeLeftForTravelOrSpentInRealm = formatSecondsLeftInDaysHours(
          nextBlockTimestamp! - npcArrivalTime!.arrives_at,
        );
      }
    }
    return (
      <>
        <div className="flex items-center ml-2 -mt-2 italic text-xxs">
          <span>From:</span>
          <OrderIcon className="mx-1" order={orderName} size="xs" />
          <span className="text-gold">{realmName}</span>
        </div>
        {!native && (
          <div className="flex ml-auto -mt-2 italic">
            <span>Has been there for: </span> <span className="ml-1 text-gold">{timeLeftForTravelOrSpentInRealm}</span>
          </div>
        )}
      </>
    );
  };

  const getNpcTravelInfo = (npc: Npc) => {
    const npcPositionEntityId = runQuery([HasValue(Position, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcPosition = getComponentValue(Position, npcPositionEntityId.values().next().value);

    const destinationRealmId = getRealmIdByPosition(npcPosition!);
    const destinationRealmName = getRealmNameById(destinationRealmId!);
    const orderName = getRealmOrderNameById(destinationRealmId!);

    const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTime, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);

    const alreadyArrived = npcArrivalTime!.arrives_at < nextBlockTimestamp!;

    const travelingStatus =
      npc.currentRealmEntityId != 0 ? "Currently in" : alreadyArrived ? "At the gates of" : "Traveling to";

    const travelingDurationStatus = alreadyArrived ? "Has been there for: " : "Arrives in:";

    const timeLeftForTravelOrSpentInRealm = formatSecondsLeftInDaysHours(
      alreadyArrived
        ? nextBlockTimestamp! - npcArrivalTime!.arrives_at
        : npcArrivalTime!.arrives_at - nextBlockTimestamp!,
    );

    return (
      <>
        <div className="flex items-center ml-2 -mt-2 italic">
          <span>{travelingStatus}:</span>
          <OrderIcon className="mx-1" order={orderName} size="xs" />
          <span className="text-gold">{destinationRealmName}</span>
        </div>
        <div className="flex ml-auto -mt-2 italic">
          <span>{travelingDurationStatus}</span>{" "}
          <span className="ml-1 text-gold">{timeLeftForTravelOrSpentInRealm}</span>
        </div>
      </>
    );
  };

  return getInfoByType();
}
