import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../context/DojoContext";
import { getEntityIdFromKeys, getPosition, getZone } from "../../utils/utils";
import { unpackResources } from "../../utils/packedData";
import useBlockchainStore from "../store/useBlockchainStore";
import { useComponentValue } from "@dojoengine/react";
import { useEffect, useState } from "react";
import { PRICE_UPDATE_INTERVAL, RealmInterface } from "@bibliothecadao/eternum";
import { Resource } from "@bibliothecadao/eternum";
import useRealmStore from "../store/useRealmStore";

// todo: move this to sdk
const DECAY = 0.1;
const UNITS_PER_DAY = 960;
const SECONDS_PER_DAY = 86400;
const FOOD_LABOR_UNITS = 12;

export enum FoodType {
  Wheat = 254,
  Fish = 255,
}

export function useLabor() {
  const {
    account: { account },
    setup: {
      optimisticSystemCalls: { optimisticBuildLabor },
      systemCalls: { purchase_and_build_labor },
      components: { LaborCostResources, LaborCostAmount, LaborAuction, Labor },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const getLaborCost = (resourceId: number): Resource[] => {
    const laborCostResources = getComponentValue(LaborCostResources, getEntityIdFromKeys([BigInt(resourceId)]));

    const resourceIds = laborCostResources
      ? unpackResources(BigInt(laborCostResources.resource_types_packed), laborCostResources.resource_types_count)
      : [];

    return resourceIds.map((costResourceId) => {
      const laborCostAmount = getComponentValue(
        LaborCostAmount,
        getEntityIdFromKeys([BigInt(resourceId), BigInt(costResourceId)]),
      );
      let amount = Number(laborCostAmount?.value) || 0;
      return { resourceId: costResourceId, amount };
    });
  };

  const getProductionCost = (resourceId: number): Resource[] => {
    const laborCostResources = getComponentValue(LaborCostResources, getEntityIdFromKeys([BigInt(resourceId)]));

    const resourceIds = laborCostResources
      ? unpackResources(BigInt(laborCostResources.resource_types_packed), laborCostResources.resource_types_count)
      : [];

    return resourceIds.map((costResourceId) => {
      const laborCostAmount = getComponentValue(
        LaborCostAmount,
        getEntityIdFromKeys([BigInt(resourceId), BigInt(costResourceId)]),
      );
      let amount = Number(laborCostAmount?.value) || 0;
      return { resourceId: costResourceId, amount };
    });
  };

  const getLaborAuctionAverageCoefficient = (zone: number, laborUnits: number): number | undefined => {
    let laborAuction = getComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    if (laborAuction && nextBlockTimestamp) {
      return computeAverageCoefficient(
        laborAuction.start_time,
        nextBlockTimestamp,
        Number(laborAuction.sold),
        laborUnits,
      );
    }
  };

  const getLaborAuctionCoefficient = (zone: number): number | undefined => {
    let laborAuction = getComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    if (laborAuction && nextBlockTimestamp) {
      return computeCoefficient(laborAuction.start_time, nextBlockTimestamp, Number(laborAuction.sold));
    }
  };

  const getNextLaborAuctionCoefficient = (zone: number, laborUnits: number): number | undefined => {
    let laborAuction = getComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    if (laborAuction && nextBlockTimestamp) {
      return computeCoefficient(
        laborAuction.start_time,
        nextBlockTimestamp,
        Number(laborAuction.sold + BigInt(laborUnits)),
      );
    }
  };

  const useLaborAuctionCoefficient = (zone: number): number | undefined => {
    const [laborCoefficient, setLaborCoefficient] = useState<number | undefined>(undefined);

    const laborAuction = useComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    useEffect(() => {
      if (laborAuction && nextBlockTimestamp) {
        setLaborCoefficient(computeCoefficient(laborAuction.start_time, nextBlockTimestamp, Number(laborAuction.sold)));
      }
    }, [laborAuction, nextBlockTimestamp]);

    return laborCoefficient;
  };

  const onBuildFood = async (foodType: FoodType, realm: RealmInterface) => {
    const position = getPosition(realm.realmId);
    const zone = getZone(position.x);

    // match multiplier by food type
    let multiplier = undefined;
    switch (foodType) {
      case FoodType.Wheat:
        multiplier = realm.rivers;
        break;
      case FoodType.Fish:
        multiplier = realm.harbors;
        break;
    }

    let coefficient = zone ? getLaborAuctionAverageCoefficient(zone, FOOD_LABOR_UNITS * multiplier) : undefined;

    if (coefficient) {
      await optimisticBuildLabor(
        nextBlockTimestamp || 0,
        [],
        coefficient,
        purchase_and_build_labor,
      )({
        signer: account,
        entity_id: realmEntityId,
        resource_type: foodType,
        labor_units: FOOD_LABOR_UNITS,
        multiplier: multiplier,
      });
    }
  };

  const getLatestRealmActivity = (realmEntityId: bigint) => {
    // proxy to get latest activity through wheat balance
    const labor = getComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(254)]));

    if (labor && nextBlockTimestamp) {
      return nextBlockTimestamp - (labor.balance - 86400);
    }
  };

  return {
    getLatestRealmActivity,
    getLaborCost,
    getLaborAuctionCoefficient,
    useLaborAuctionCoefficient,
    getLaborAuctionAverageCoefficient,
    getNextLaborAuctionCoefficient,
    onBuildFood,
    getProductionCost,
  };
}

function computeCoefficient(startTimestamp: number, nextBlockTimestamp: number, sold: number) {
  return Math.exp(
    Math.log(1 - DECAY) * (Math.floor((nextBlockTimestamp - startTimestamp) / SECONDS_PER_DAY) - sold / UNITS_PER_DAY),
  );
}

function computeAverageCoefficient(
  startTimestamp: number,
  nextBlockTimestamp: number,
  sold: number,
  laborUnits: number,
): number {
  let sum = 0;
  let multiplier = computeCoefficient(startTimestamp, nextBlockTimestamp, sold);
  // start at number of units already sold and add 1 everytime
  for (let i = sold; i < sold + laborUnits; i++) {
    if (i % PRICE_UPDATE_INTERVAL == 0) {
      multiplier = computeCoefficient(startTimestamp, nextBlockTimestamp, i);
      sum += multiplier;
    } else {
      sum += multiplier;
    }
  }
  return sum / laborUnits; // Return the average coefficient}
}
