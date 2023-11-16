import { useMemo } from "react";
import { BaseRegionTooltip } from "../../../elements/BaseRegionTooltip";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../DojoContext";
import { divideByPrecision, getEntityIdFromKeys } from "../../../utils/utils";
import { LABOR_CONFIG, findResourceById } from "@bibliothecadao/eternum";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { calculateNextHarvest, calculateProductivity, formatSecondsInHoursMinutes } from "../realm/labor/laborUtils";
import ProgressBar from "../../../elements/ProgressBar";
import { useRealm } from "../../../hooks/helpers/useRealm";

type LaborRegionTooltipProps = {
  position: [number, number, number];
  resourceId: number;
};

export const LaborRegionTooltip = ({ position, resourceId }: LaborRegionTooltipProps) => {
  let { realmEntityId } = useRealmStore();

  const {
    setup: {
      components: { Labor },
    },
  } = useDojo();

  const resource = findResourceById(resourceId);

  const labor = useComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { getRealmLevel } = useRealm();
  const level = getRealmLevel(realmEntityId)?.level || 0;

  const laborLeft = useMemo(() => {
    if (nextBlockTimestamp && labor && LABOR_CONFIG && labor.balance > nextBlockTimestamp) {
      let left = labor.balance - nextBlockTimestamp;
      return left < LABOR_CONFIG.base_labor_units ? 0 : left;
    }
    return 0;
  }, [nextBlockTimestamp, labor]);

  const timeLeftToHarvest = useMemo(() => {
    if (nextBlockTimestamp && labor && labor.last_harvest > 0) {
      if (nextBlockTimestamp > labor.last_harvest && labor.balance > nextBlockTimestamp) {
        const timeSinceLastHarvest = nextBlockTimestamp - labor.last_harvest;
        return LABOR_CONFIG.base_labor_units - (timeSinceLastHarvest % LABOR_CONFIG.base_labor_units);
      }
    }
    return undefined;
  }, [labor, nextBlockTimestamp]);

  const nextHarvest = useMemo(() => {
    if (labor && nextBlockTimestamp) {
      return calculateNextHarvest(
        labor.balance,
        labor.last_harvest,
        labor.multiplier,
        LABOR_CONFIG.base_labor_units,
        LABOR_CONFIG.base_resources_per_cycle,
        nextBlockTimestamp,
        level,
      );
    } else {
      return 0;
    }
  }, [labor, nextBlockTimestamp]);

  return (
    <BaseRegionTooltip position={position} distanceFactor={400}>
      <div className="flex items-center">
        <ResourceIcon resource={resource.trait} size="sm" />
        <div className=" ml-2 text-sm text-gold font-bold">{resource.trait} Mine</div>
        <div className="flex flex-col ml-auto text-xxs">
          <div className="flex items-center mx-auto text-white/70">
            {labor && laborLeft > 0
              ? `+${divideByPrecision(
                  calculateProductivity(
                    LABOR_CONFIG.base_resources_per_cycle,
                    labor.multiplier,
                    LABOR_CONFIG.base_labor_units,
                    level,
                  ),
                ).toFixed(0)}`
              : "+0"}
            <ResourceIcon
              containerClassName="mx-0.5"
              className="!w-[12px]"
              resource={findResourceById(resourceId)?.trait as any}
              size="xs"
            />
            /h
          </div>
        </div>
      </div>
      <ProgressBar
        rounded
        progress={timeLeftToHarvest ? 100 - (timeLeftToHarvest / LABOR_CONFIG.base_labor_units) * 100 : 0}
        className="bg-white mt-2"
      />
      <div className="flex justtify-between mt-2 text-xxs">
        <div className="italic text-white/70">
          {laborLeft > 60 ? `${formatSecondsInHoursMinutes(laborLeft)}` : "Idle"}
        </div>
        <div className="flex ml-auto">
          <ResourceIcon resource={resource.trait as any} size="xs" className="!w-[12px]" />
          <div className="mx-1 text-brilliance">{`+${divideByPrecision(nextHarvest)}`}</div>
        </div>
      </div>
    </BaseRegionTooltip>
  );
};
