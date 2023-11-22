import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import { NumberInput } from "../../../../elements/NumberInput";
import { ResourcesIds, findResourceById, PurchaseLaborProps, BuildLaborProps } from "@bibliothecadao/eternum";
import { ReactComponent as FishingVillages } from "../../../../assets/icons/resources/FishingVillages.svg";
import { ReactComponent as Farms } from "../../../../assets/icons/resources/Farms.svg";
import { ResourceIcon } from "../../../../elements/ResourceIcon";
import { BuildingsCount } from "../../../../elements/BuildingsCount";
import clsx from "clsx";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../DojoContext";
import { formatSecondsLeftInDaysHours } from "./laborUtils";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { getComponentValue } from "@latticexyz/recs";
import { divideByPrecision, getEntityIdFromKeys, getPosition, getZone } from "../../../../utils/utils";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { useGetRealm } from "../../../../hooks/helpers/useRealm";
import { useLabor } from "../../../../hooks/helpers/useLabor";
import { LaborAuction } from "./LaborAuction";
import { LABOR_CONFIG } from "@bibliothecadao/eternum";

type LaborBuildPopupProps = {
  resourceId: number;
  setBuildLoadingStates: (prevStates: any) => void;
  onClose: () => void;
};

export const LaborBuildPopup = ({ resourceId, setBuildLoadingStates, onClose }: LaborBuildPopupProps) => {
  const {
    setup: {
      components: { Resource, Labor },
      systemCalls: { purchase_and_build_labor },
      optimisticSystemCalls: { optimisticBuildLabor },
    },
    account: { account },
  } = useDojo();

  const [hasEnoughResources, setHasEnoughResources] = useState(true);
  const [laborAmount, setLaborAmount] = useState(1);
  const [multiplier, setMultiplier] = useState(1);

  useEffect(() => {
    setMultiplier(1); // Reset the multiplier to 1 when the resourceId changes
  }, [resourceId]);

  const onMultiplierChange = (value: number) => {
    if (resourceId === 254) {
      setMultiplier(Math.min(value, realm?.rivers || 0));
    } else {
      setMultiplier(Math.min(value, realm?.harbors || 0));
    }
  };

  let { realmEntityId, realmId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);
  const laborUnits = useMemo(() => (isFood ? 12 : laborAmount), [laborAmount]);
  const resourceInfo = useMemo(() => findResourceById(resourceId), [resourceId]);

  const { getLaborCost, getLaborAuctionAverageCoefficient } = useLabor();

  const labor = getComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));
  const hasLaborLeft = useMemo(() => {
    if (nextBlockTimestamp && labor && labor.balance > nextBlockTimestamp) {
      return true;
    }
    return false;
  }, [nextBlockTimestamp, labor]);

  const position = realmId ? getPosition(realmId) : undefined;
  const zone = position ? getZone(position.x) : undefined;

  const laborAuctionAverageCoefficient = useMemo(() => {
    let coefficient = zone ? getLaborAuctionAverageCoefficient(zone, laborUnits * multiplier) : undefined;
    return coefficient || 1;
  }, [zone, laborUnits, multiplier]);

  const costResources = useMemo(() => getLaborCost(resourceId), [resourceId]);

  const getTotalAmount = (
    amount: number,
    isFood: boolean,
    multiplier: number,
    laborAmount: number,
    laborCoefficient: number,
  ) => {
    return amount * multiplier * (isFood ? 12 : laborAmount) * laborCoefficient;
  };

  const buildLabor = async ({
    entity_id,
    resource_type,
    labor_units,
    multiplier,
  }: PurchaseLaborProps & BuildLaborProps) => {
    await purchase_and_build_labor({
      signer: account,
      entity_id,
      resource_type,
      labor_units,
      multiplier,
    });
  };

  useEffect(() => {
    setHasEnoughResources(false);
    const hasEnough = costResources.every(({ resourceId, amount }) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );
      return (
        realmResource &&
        realmResource.balance >= getTotalAmount(amount, isFood, multiplier, laborAmount, laborAuctionAverageCoefficient)
      );
    });

    setHasEnoughResources(hasEnough);
  }, [laborAmount, multiplier, costResources]);

  const onBuild = () => {
    optimisticBuildLabor(
      nextBlockTimestamp || 0,
      costResources,
      laborAuctionAverageCoefficient,
      buildLabor,
    )({
      signer: account,
      entity_id: realmEntityId,
      resource_type: resourceId,
      labor_units: laborUnits,
      multiplier: multiplier,
    }),
      playLaborSound(resourceId);
    onClose();
  };

  const { play: playFarm } = useUiSounds(soundSelector.buildFarm);
  const { play: playFishingVillage } = useUiSounds(soundSelector.buildFishingVillage);
  const { play: playAddWood } = useUiSounds(soundSelector.addWood);
  const { play: playAddStone } = useUiSounds(soundSelector.addStone);
  const { play: playAddCoal } = useUiSounds(soundSelector.addCoal);
  const { play: playAddCopper } = useUiSounds(soundSelector.addCopper);
  const { play: playAddObsidian } = useUiSounds(soundSelector.addObsidian);
  const { play: playAddSilver } = useUiSounds(soundSelector.addSilver);
  const { play: playAddIronwood } = useUiSounds(soundSelector.addIronwood);
  const { play: playAddColdIron } = useUiSounds(soundSelector.addColdIron);
  const { play: playAddGold } = useUiSounds(soundSelector.addGold);
  const { play: playAddHartwood } = useUiSounds(soundSelector.addHartwood);
  const { play: playAddDiamonds } = useUiSounds(soundSelector.addDiamonds);
  const { play: playAddSapphire } = useUiSounds(soundSelector.addSapphire);
  const { play: playAddRuby } = useUiSounds(soundSelector.addRuby);
  const { play: playAddDeepCrystal } = useUiSounds(soundSelector.addDeepCrystal);
  const { play: playAddIgnium } = useUiSounds(soundSelector.addIgnium);
  const { play: playAddEtherealSilica } = useUiSounds(soundSelector.addEtherealSilica);

  const { play: playAddTrueIce } = useUiSounds(soundSelector.addTrueIce);
  const { play: playAddTwilightQuartz } = useUiSounds(soundSelector.addTwilightQuartz);
  const { play: playAddAlchemicalSilver } = useUiSounds(soundSelector.addAlchemicalSilver);
  const { play: playAddAdamantine } = useUiSounds(soundSelector.addAdamantine);
  const { play: playAddMithral } = useUiSounds(soundSelector.addMithral);
  const { play: playAddDragonhide } = useUiSounds(soundSelector.addDragonhide);

  const playLaborSound = (resourceId: ResourcesIds) => {
    // eslint-disable-next-line sonarjs/no-small-switch
    switch (resourceId) {
      case ResourcesIds.Fish:
        playFishingVillage();
        break;
      case ResourcesIds.Wheat:
        playFarm();
        break;
      case ResourcesIds.Wood:
        playAddWood();
        break;
      case ResourcesIds.Stone:
        playAddStone();
        break;
      case ResourcesIds.Coal:
        playAddCoal();
        break;
      case ResourcesIds.Copper:
        playAddCopper();
        break;
      case ResourcesIds.Obsidian:
        playAddObsidian();
        break;
      case ResourcesIds.Silver:
        playAddSilver();
        break;
      case ResourcesIds.Ironwood:
        playAddIronwood();
        break;
      case ResourcesIds.ColdIron:
        playAddColdIron();
        break;
      case ResourcesIds.Gold:
        playAddGold();
        break;
      case ResourcesIds.Hartwood:
        playAddHartwood();
        break;
      case ResourcesIds.Diamonds:
        playAddDiamonds();
        break;
      case ResourcesIds.Sapphire:
        playAddSapphire();
        break;
      case ResourcesIds.Ruby:
        playAddRuby();
        break;
      case ResourcesIds.DeepCrystal:
        playAddDeepCrystal();
        break;
      case ResourcesIds.Ignium:
        playAddIgnium();
        break;
      case ResourcesIds.EtherealSilica:
        playAddEtherealSilica();
        break;
      case ResourcesIds.TrueIce:
        playAddTrueIce();
        break;
      case ResourcesIds.TwilightQuartz:
        playAddTwilightQuartz();
        break;
      case ResourcesIds.AlchemicalSilver:
        playAddAlchemicalSilver();
        break;
      case ResourcesIds.Adamantine:
        playAddAdamantine();
        break;
      case ResourcesIds.Mithral:
        playAddMithral();
        break;
      case ResourcesIds.Dragonhide:
        playAddDragonhide();
        break;
      default:
        break;
    }
  };

  return (
    <SecondaryPopup name="labor">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build Labor:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline size="big">Produce More {resourceInfo?.trait}</Headline>
          <div className="relative flex justify-between w-full mt-2 text-xxs text-lightest">
            <div className="flex items-center">
              {!isFood && (
                <>
                  <ResourceIcon className="mr-1" resource={resourceInfo?.trait || ""} size="xs" /> {resourceInfo?.trait}
                </>
              )}
              {resourceId === 254 && (
                <div className="flex items-center">
                  <Farms className="mr-1" />
                  <span className="mr-1 font-bold">{`${multiplier}/${realm?.rivers || 0}`}</span> Farms
                </div>
              )}
              {resourceId === 255 && (
                <div className="flex items-center">
                  {/* // DISCUSS: can only be 0, because that is when you can build */}
                  <FishingVillages className="mr-1" />
                  <span className="mr-1 font-bold">{`${multiplier}/${realm?.harbors || 0}`}</span> Fishing Villages
                </div>
              )}
            </div>
            <div className="flex items-center">
              {`+${isFood ? divideByPrecision(LABOR_CONFIG.base_food_per_cycle * multiplier) / 2 : ""}${
                isFood ? "" : divideByPrecision(LABOR_CONFIG.base_resources_per_cycle) / 2
              }`}
              <ResourceIcon
                containerClassName="mx-0.5"
                className="!w-[12px]"
                resource={findResourceById(resourceId)?.trait as any}
                size="xs"
              />
              /h
            </div>
          </div>
          {isFood && (
            <BuildingsCount
              count={multiplier}
              // note: need to limit to 4 because of temp gas limit
              maxCount={resourceId === 254 ? realm?.rivers || 0 : realm?.harbors || 0}
              className="mt-2"
            />
          )}
          <div className={clsx("relative w-full", isFood ? "mt-2" : "mt-3")}>
            {resourceId === 254 && (
              <img src={`/images/buildings/farm.png`} className="object-cover w-full h-full rounded-[10px]" />
            )}
            {resourceId === 255 && (
              <img
                src={`/images/buildings/fishing_village.png`}
                className="object-cover w-full h-full rounded-[10px]"
              />
            )}
            {!isFood && (
              <img src={`/images/resources/${resourceId}.jpg`} className="object-cover w-full h-full rounded-[10px]" />
            )}
            <div className="absolute top-2 left-2 bg-black/60 rounded-[10px] p-3 hover:bg-black">
              <LaborAuction />
            </div>
            <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Price:</div>
              <div className="grid grid-cols-4 gap-2">
                {costResources.map(({ resourceId, amount }) => (
                  <ResourceCost
                    withTooltip
                    key={resourceId}
                    type="vertical"
                    resourceId={resourceId}
                    amount={Number(
                      divideByPrecision(
                        getTotalAmount(amount, isFood, multiplier, laborAmount, laborAuctionAverageCoefficient),
                      ).toFixed(2),
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between m-2 text-xxs">
          {!isFood && (
            <div className="flex items-center">
              <div className="italic text-light-pink">Amount</div>
              {/* note: max 76 for now because of gas, can remove after new contract deployment */}
              <NumberInput className="ml-2 mr-2" value={laborAmount} step={5} onChange={setLaborAmount} max={76} />
              <div className="italic text-gold">
                {formatSecondsLeftInDaysHours(laborAmount * divideByPrecision(LABOR_CONFIG?.base_labor_units || 0))}
              </div>
            </div>
          )}
          {isFood && (
            <div className="flex items-center">
              <div className="italic text-light-pink">Amount</div>
              <NumberInput
                className="ml-2 mr-2"
                value={multiplier}
                onChange={onMultiplierChange}
                max={resourceId === 254 ? realm?.rivers || 0 : realm?.harbors || 0}
              />
              <div className="italic text-gold">
                Max {resourceId === 254 ? realm?.rivers || 0 : realm?.harbors || 0}
              </div>
            </div>
          )}
          <div className="flex flex-col items-center justify-center">
            <Button
              className="!px-[6px] !py-[2px] text-xxs ml-auto"
              disabled={!hasEnoughResources || (isFood && hasLaborLeft)}
              onClick={() => onBuild()}
              variant="outline"
              withoutSound
            >
              {isFood ? `Build` : `Buy Tools`}
            </Button>
            {!hasEnoughResources && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
            {isFood && hasLaborLeft && <div className="text-xxs text-order-giants/70">Finish 24h cycle</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
