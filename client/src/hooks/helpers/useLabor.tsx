import { getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { getEntityIdFromKeys } from "../../utils/utils";
import { unpackResources } from "../../utils/packedData";
import useBlockchainStore from "../store/useBlockchainStore";
import { useComponentValue } from "@dojoengine/react";
import { useEffect, useState } from "react";
import { PRICE_UPDATE_INTERVAL } from "@bibliothecadao/eternum";

export interface LaborCostInterface {
  resourceId: number;
  amount: number;
}

export function useLabor() {
  const {
    setup: {
      components: { LaborCostResources, LaborCostAmount, LaborAuction },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const getLaborCost = (resourceId: number): LaborCostInterface[] => {
    const laborCostResources = getComponentValue(LaborCostResources, getEntityIdFromKeys([BigInt(resourceId)]));

    const resourceIds = laborCostResources
      ? unpackResources(BigInt(laborCostResources.resource_types_packed), laborCostResources.resource_types_count)
      : [];

    return resourceIds.map((costResourceId) => {
      const laborCostAmount = getComponentValue(
        LaborCostAmount,
        getEntityIdFromKeys([BigInt(resourceId), BigInt(costResourceId)]),
      );
      let amount = laborCostAmount?.value || 0;
      return { resourceId: costResourceId, amount };
    });
  };

  const getLaborAuctionAverageCoefficient = (zone: number, laborUnits: number): number | undefined => {
    let laborAuction = getComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    if (laborAuction && nextBlockTimestamp) {
      return computeAverageCoefficient(laborAuction.start_time, nextBlockTimestamp, laborAuction.sold, laborUnits);
    }
  };

  const getLaborAuctionCoefficient = (zone: number): number | undefined => {
    let laborAuction = getComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    if (laborAuction && nextBlockTimestamp) {
      return computeCoefficient(laborAuction.start_time, nextBlockTimestamp, laborAuction.sold);
    }
  };

  const getNextLaborAuctionCoefficient = (zone: number, laborUnits: number): number | undefined => {
    let laborAuction = getComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    if (laborAuction && nextBlockTimestamp) {
      return computeCoefficient(laborAuction.start_time, nextBlockTimestamp, laborAuction.sold + laborUnits);
    }
  };

  const useLaborAuctionCoefficient = (zone: number): number | undefined => {
    const [laborCoefficient, setLaborCoefficient] = useState<number | undefined>(undefined);

    const laborAuction = useComponentValue(LaborAuction, getEntityIdFromKeys([BigInt(zone)]));

    useEffect(() => {
      if (laborAuction && nextBlockTimestamp) {
        setLaborCoefficient(computeCoefficient(laborAuction.start_time, nextBlockTimestamp, laborAuction.sold));
      }
    }, [laborAuction, nextBlockTimestamp]);

    return laborCoefficient;
  };

  return {
    getLaborCost,
    getLaborAuctionCoefficient,
    useLaborAuctionCoefficient,
    getLaborAuctionAverageCoefficient,
    getNextLaborAuctionCoefficient,
  };
}

const DECAY = 0.1;
const UNITS_PER_DAY = 960;
const SECONDS_PER_DAY = 86400;

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
