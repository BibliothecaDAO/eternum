import { useMemo } from "react";
import { getPosition } from "../../utils/utils";
import { CombatResultInterface, Position, ResourcesIds } from "@bibliothecadao/eternum";
import { unpackResources } from "../../utils/packedData";
import { getRealm } from "../../utils/realms";
import { EventType, NotificationType } from "../store/useNotificationsStore";

export type realmsResources = { realmEntityId: bigint; resourceIds: number[] }[];
export type realmsPosition = { realmId: bigint; position: Position; realmEntityId: bigint }[];

/**
 * Get all resources present on each realm
 * @param realms
 * @returns
 */
export const useRealmsResource = (
  realms: {
    realmEntityId: bigint;
    realmId: bigint;
  }[],
): realmsResources => {
  return useMemo(() => {
    return realms
      .map(({ realmEntityId, realmId }) => {
        const { resourceTypesPacked, resourceTypesCount } = realmId
          ? getRealm(realmId) || { resourceTypesPacked: 0, resourceTypesCount: 0 }
          : { resourceTypesPacked: 0, resourceTypesCount: 0 };

        if (realmId) {
          let unpackedResources = unpackResources(BigInt(resourceTypesPacked), resourceTypesCount);
          return {
            realmEntityId,
            resourceIds: [ResourcesIds["Wheat"], ResourcesIds["Fish"]].concat(unpackedResources),
          };
        }
        return null;
      })
      .filter(Boolean) as { realmEntityId: bigint; resourceIds: number[] }[];
  }, [realms]);
};

/**
 * Gets all positions of each realm
 * @param realms
 * @returns
 */
export const useRealmsPosition = (
  realms: {
    realmEntityId: bigint;
    realmId: bigint;
  }[],
): realmsPosition => {
  return useMemo(() => {
    return realms.map(({ realmId, realmEntityId }) => {
      return { realmId, position: getPosition(realmId), realmEntityId };
    });
  }, [realms]);
};

export const createCombatNotification = (result: CombatResultInterface): NotificationType => {
  let eventType = EventType.Attacked;
  if (result.stolenResources.length > 0) {
    eventType = EventType.StolenResource;
  }
  return {
    eventType,
    // to have a unique key for each notification
    keys: [result.attackTimestamp.toString()],
    data: result,
  };
};
