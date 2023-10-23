import Button from "../../../../elements/Button";
import { ResourceIcon } from "../../../../elements/ResourceIcon";
import { ResourcesIds, findResourceById, LABOR_CONFIG } from "@bibliothecadao/eternum";
import { currencyFormat, divideByPrecision, getEntityIdFromKeys } from "../../../../utils/utils.jsx";
import { ReactComponent as Clock } from "../../../../assets/icons/common/clock.svg";
import { ReactComponent as Village } from "../../../../assets/icons/common/village.svg";
import ProgressBar from "../../../../elements/ProgressBar";
import { useDojo } from "../../../../DojoContext";
import { Realm } from "../../../../types";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { calculateNextHarvest, calculateProductivity, formatSecondsInHoursMinutes } from "./laborUtils";
import { useMemo } from "react";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { useComponentValue } from "@dojoengine/react";
import useRealmStore from "../../../../hooks/store/useRealmStore";

type LaborComponentProps = {
  resourceId: number;
  realm: Realm;
  buildLoadingStates: { [key: number]: boolean };
  setBuildLoadingStates: (prevStates: any) => void;
  onBuild: () => void;
};

export const LaborComponent = ({
  resourceId,
  realm,
  onBuild,
  setBuildLoadingStates,
  buildLoadingStates,
}: LaborComponentProps) => {
  const {
    setup: {
      components: { Labor, Resource },
      systemCalls: { harvest_labor },
      optimisticSystemCalls: { optimisticHarvestLabor },
    },
    account: { account },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { realmEntityId } = useRealmStore();

  const labor = useComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));

  const resource = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));

  // time until the next possible harvest (that happens every 7200 seconds (2hrs))
  // if labor balance is less than current time, then there is no time to next harvest
  const timeLeftToHarvest = useMemo(() => {
    if (nextBlockTimestamp && labor && labor.last_harvest > 0) {
      if (nextBlockTimestamp > labor.last_harvest && labor.balance > nextBlockTimestamp) {
        const timeSinceLastHarvest = nextBlockTimestamp - labor.last_harvest;
        return LABOR_CONFIG.base_labor_units - (timeSinceLastHarvest % LABOR_CONFIG.base_labor_units);
      }
    }
    return undefined;
  }, [labor, nextBlockTimestamp]);

  const { play: playHarvest } = useUiSounds(soundSelector.harvest);

  const onHarvest = () => {
    playHarvest();
    optimisticHarvestLabor(
      nextBlockTimestamp || 0,
      harvest_labor,
    )({
      signer: account,
      realm_id: realmEntityId,
      resource_type: resourceId,
    });
  };

  // if the labor balance does not exist or is lower than the current time,
  // then there is no labor left
  const laborLeft = useMemo(() => {
    if (nextBlockTimestamp && labor && labor.balance > nextBlockTimestamp) {
      return labor.balance - nextBlockTimestamp;
    }
    return 0;
  }, [nextBlockTimestamp, labor]);

  const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);

  const nextHarvest = useMemo(() => {
    if (labor && nextBlockTimestamp) {
      return calculateNextHarvest(
        labor.balance,
        labor.last_harvest,
        labor.multiplier,
        LABOR_CONFIG.base_labor_units,
        isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
        nextBlockTimestamp,
      );
    } else {
      return 0;
    }
  }, [labor, nextBlockTimestamp]);

  return (
    <div className="relative flex flex-col border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="absolute top-0 left-0 flex items-center px-1 italic border border-t-0 border-l-0 text-white/70 rounded-tl-md bg-black/60 rounded-br-md border-gray-gold">
        {findResourceById(resourceId)?.trait}
      </div>
      <div className="grid grid-cols-6">
        <img src={`/images/resources/${resourceId}.jpg`} className="object-cover w-full h-full rounded-md" />
        <div className="flex flex-col w-full h-full col-span-5 p-2 text-white/70">
          <div className="flex items-center mb-2">
            <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="sm" />
            <div className="ml-2 text-xs font-bold text-white">
              {currencyFormat(resource ? resource.balance : 0, 2)}
            </div>
            <div className="flex items-center ml-auto">
              {isFood && <Village />}
              {/* // DISCUSS: when there is no labor anymore, it means full decay of the buildings, so it should be multiplier 0 */}
              {/* note: need to limit to 4 for now because of gas limit */}
              {resourceId == ResourcesIds["Wheat"] && (
                <div className="px-2">{`${laborLeft > 0 && labor ? labor.multiplier : 0}/${Math.min(
                  realm?.rivers,
                  4,
                )}`}</div>
              )}
              {/* note: need to limit to 4 for now because of gas limit */}
              {resourceId == ResourcesIds["Fish"] && (
                <div className="px-2">{`${laborLeft > 0 && labor ? labor.multiplier : 0}/${Math.min(
                  realm?.harbors,
                  4,
                )}`}</div>
              )}
              {/* // TODO: show visual cue that it's disabled */}
              {!buildLoadingStates[resourceId] && (
                <Button variant="outline" className="px-2 py-1" onClick={onBuild} disabled={isFood && laborLeft > 0}>
                  {isFood ? `Build` : `Buy Tools`}
                </Button>
              )}
              {buildLoadingStates[resourceId] && (
                <Button
                  isLoading={true}
                  onClick={() => {}}
                  variant="danger"
                  className="ml-auto p-2 !h-4 text-xxs !rounded-md"
                >
                  {}
                </Button>
              )}
            </div>
          </div>
          <ProgressBar
            rounded
            progress={timeLeftToHarvest ? 100 - (timeLeftToHarvest / LABOR_CONFIG.base_labor_units) * 100 : 0}
            className="bg-white"
          />
          <div className="flex items-center mt-2">
            <>
              <Clock />
              <div className="ml-1 italic text-white/70">
                {laborLeft > 60 ? `${formatSecondsInHoursMinutes(laborLeft)} left` : "No Labor"}
              </div>
            </>

            <div className="flex items-center mx-auto text-white/70">
              {labor && laborLeft > 0
                ? `+${divideByPrecision(
                    calculateProductivity(
                      isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
                      labor.multiplier,
                      LABOR_CONFIG.base_labor_units,
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
            <>
              <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="xs" className="!w-[12px]" />
              <div className="mx-1 text-brilliance">{`+${divideByPrecision(nextHarvest)}`}</div>
            </>
            {/* // TODO: visual cue to show disabled? */}
            <Button
              className="!px-[6px] !py-[2px] text-xxs"
              variant="success"
              disabled={nextHarvest === 0}
              onClick={onHarvest}
            >
              Harvest
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
