import Button from "../../../../elements/Button";
import { ResourcesIds, findResourceById, LABOR_CONFIG, type RealmInterface } from "@bibliothecadao/eternum";
import { currencyFormat, divideByPrecision, getEntityIdFromKeys } from "../../../../utils/utils.js";
import { ReactComponent as Clock } from "@/assets/icons/common/clock.svg";
import { ReactComponent as Village } from "@/assets/icons/common/village.svg";
import ProgressBar from "../../../../elements/ProgressBar";
import { useDojo } from "../../../../../hooks/context/DojoContext";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { calculateNextHarvest, calculateProductivity, formatSecondsInHoursMinutes } from "./laborUtils";
import { useMemo } from "react";
import { usePlayResourceSound, soundSelector, useUiSounds } from "../../../../../hooks/useUISound";
import { useComponentValue } from "@dojoengine/react";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { LevelIndex, useLevel } from "../../../../hooks/helpers/useLevel";
import { EventType, useNotificationsStore } from "../../../../hooks/store/useNotificationsStore";
import { FoodType, useLabor } from "../../../../hooks/helpers/useLabor";
import useUIStore from "../../../../hooks/store/useUIStore";
import { ReactComponent as People } from "../../../../assets/icons/common/people.svg";
import { useResourceBalance } from "../../../../hooks/helpers/useResources";

interface LaborComponentProps {
  hasGuild: boolean;
  resourceId: number;
  realm: RealmInterface;
  setBuildResource: (resourceId: number) => void;
  buildLoadingStates: Record<number, boolean>;
  setBuildLoadingStates: (prevStates: any) => void;
  className?: string;
  locked?: boolean;
}

export const LaborComponent = ({
  hasGuild,
  resourceId,
  realm,
  setBuildResource,
  buildLoadingStates,
  className,
  locked,
}: LaborComponentProps) => {
  const {
    setup: {
      components: { Labor, Resource },
      systemCalls: { harvest_labor },
      optimisticSystemCalls: { optimisticHarvestLabor },
    },
    account: { account },
  } = useDojo();

  const { useBalance } = useResourceBalance();

  const { playResourceSound } = usePlayResourceSound();
  const { play: playBuildFarm } = useUiSounds(soundSelector.buildFarm);
  const { play: playBuildFishingVillage } = useUiSounds(soundSelector.buildFishingVillage);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const labor = useComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));
  const resource = useBalance(realmEntityId, resourceId);

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

  const { onBuildFood } = useLabor();

  const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);

  const { getEntityLevel, getRealmLevelBonus } = useLevel();
  const conqueredHyperstructureNumber = useUIStore((state) => state.conqueredHyperstructureNumber);

  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);

  // get harvest bonuses
  const [levelBonus, hyperstructureLevelBonus] = useMemo(() => {
    const level = getEntityLevel(realmEntityId)?.level || 0;
    const levelBonus = getRealmLevelBonus(level, isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE);
    return [levelBonus, conqueredHyperstructureNumber * 25 + 100];
  }, [realmEntityId, isFood]);

  const onBuild = async () => {
    if (resourceId == ResourcesIds.Wheat) {
      playBuildFarm();
      await onBuildFood(FoodType.Wheat, realm);
    } else if (resourceId == ResourcesIds.Fish) {
      playBuildFishingVillage();
      await onBuildFood(FoodType.Fish, realm);
    } else {
      setBuildResource(resourceId);
    }
  };

  const onHarvest = () => {
    if (hyperstructureLevelBonus) {
      playResourceSound(resourceId);
      optimisticHarvestLabor(
        nextBlockTimestamp || 0,
        levelBonus,
        hyperstructureLevelBonus,
        harvest_labor,
      )({
        signer: account,
        realm_id: realmEntityId,
        resource_type: resourceId,
      });
      deleteNotification([realmEntityId.toString(), resourceId.toString()], EventType.Harvest);
    }
  };

  // if the labor balance does not exist or is lower than the current time,
  // then there is no labor left
  const laborLeft = useMemo(() => {
    if (nextBlockTimestamp && labor && labor.balance > nextBlockTimestamp) {
      return labor.balance - nextBlockTimestamp;
    }
    return 0;
  }, [nextBlockTimestamp, labor]);

  const nextHarvest = useMemo(() => {
    if (labor && nextBlockTimestamp && hyperstructureLevelBonus) {
      return calculateNextHarvest(
        labor.balance,
        labor.last_harvest,
        labor.multiplier,
        LABOR_CONFIG.base_labor_units,
        isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
        nextBlockTimestamp,
        levelBonus,
        hyperstructureLevelBonus,
      );
    } else {
      return 0;
    }
  }, [labor, nextBlockTimestamp]);

  return (
    <div className="relative">
      {locked && (
        <div className="absolute text-gold text-xs top-0 left-0 w-full text-center flex justify-center h-full">
          <div className="self-center p-1 border rounded">locked until Realm level 1</div>
        </div>
      )}

      <div
        className={`relative flex flex-col border rounded-md border-gray-gold text-xxs text-gray-gold ${className} ${
          locked ? "blur-sm" : ""
        }`}
      >
        <div className="absolute top-0 left-0 flex items-center px-1 italic font-bold border border-t-0 border-l-0 text-white/70 rounded-tl-md bg-black/90 rounded-br-md border-gray-gold">
          {findResourceById(resourceId)?.trait}
        </div>
        <div className="grid grid-cols-6">
          <img src={`/images/resources/${resourceId}.png`} className="object-cover w-full h-full rounded-md" />
          <div className="flex flex-col w-full h-full col-span-5 p-2 text-white/70">
            <div className="flex items-center mb-2">
              {/* <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="sm" /> */}
              <div className="ml-2 text-sm font-bold text-white">
                <span className="opacity-60">{currencyFormat(resource ? Number(resource.amount) : 0, 2)}</span>

                <span className={`ml-3  ${labor && laborLeft > 0 ? "text-gold" : "text-gray-gold"}`}>
                  {hyperstructureLevelBonus && labor && laborLeft > 0
                    ? `+${divideByPrecision(
                        calculateProductivity(
                          isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
                          labor.multiplier,
                          LABOR_CONFIG.base_labor_units,
                          levelBonus,
                          hyperstructureLevelBonus,
                        ),
                      ).toFixed(0)}`
                    : "+0"}
                  /h
                </span>
              </div>
              <div className="flex items-center ml-auto">
                {isFood && <Village />}
                {/* // DISCUSS: when there is no labor anymore, it means full decay of the buildings, so it should be multiplier 0 */}
                {resourceId == ResourcesIds.Wheat && (
                  <div className="px-2">{`${laborLeft > 0 && labor ? labor.multiplier : 0}/${realm?.rivers}`}</div>
                )}
                {resourceId == ResourcesIds.Fish && (
                  <div className="px-2">{`${laborLeft > 0 && labor ? labor.multiplier : 0}/${realm?.harbors}`}</div>
                )}
                {/* // TODO: show visual cue that it's disabled */}
                {hasGuild && (
                  <div
                    onMouseEnter={() =>
                      setTooltip({
                        position: "bottom",
                        content: (
                          <>
                            <p className="whitespace-nowrap">Has guild for this resource</p>
                          </>
                        ),
                      })
                    }
                    onMouseLeave={() => setTooltip(null)}
                    className="flex flex-col justify-center align-center w-full items-center mr-2"
                  >
                    <People className="stroke-2 h-3 stroke-gold "></People>
                    {/* <div className="w-full text-center">0</div> */}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="px-2 py-1"
                  onClick={onBuild}
                  disabled={isFood && laborLeft > 0}
                  isLoading={buildLoadingStates[resourceId]}
                >
                  {isFood ? "Build" : "Add Production"}
                </Button>
              </div>
            </div>
            <ProgressBar
              rounded
              progress={timeLeftToHarvest ? 100 - (timeLeftToHarvest / LABOR_CONFIG.base_labor_units) * 100 : 0}
              className="bg-white animate-pulse"
            />
            <div className="flex items-center mt-2">
              <>
                <Clock />
                <div className="ml-1 italic text-white/90">
                  {laborLeft > 60 ? `${formatSecondsInHoursMinutes(laborLeft)} left` : "No Labor"}
                </div>
              </>
              <>
                {/* <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="xs" className="!w-[12px]" /> */}
                <div className="ml-auto text-brilliance px-2">{`+${divideByPrecision(nextHarvest)}`}</div>
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
    </div>
  );
};
