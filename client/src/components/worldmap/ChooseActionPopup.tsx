import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { divideByPrecision, formatTimeLeftDaysHoursMinutes, getUIPositionFromColRow, multiplyByPrecision } from "../../utils/utils";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import Button from "../../elements/Button";
import { TravelPopup } from "./traveling/TravelPopup";
import { ExploreMapPopup } from "./explore/ExploreHexPopup";
import useBlockchainStore from "../../hooks/store/useBlockchainStore";
import { TIME_PER_TICK } from "../network/EpochCountdown";
import { getTotalResourceWeight } from "../cityview/realm/trade/utils";
import { Resource, ResourcesIds, WEIGHTS } from "@bibliothecadao/eternum";

type ChooseActionPopupProps = {};

export const ChooseActionPopup = ({}: ChooseActionPopupProps) => {
  const {
    setup: {
      components: { TickMove, ArrivalTime, Weight, Quantity, Capacity },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setSelectedPath = useUIStore((state) => state.setSelectedPath);
  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const setIsAttackMode = useUIStore((state) => state.setIsAttackMode);
  const isAttackMode = useUIStore((state) => state.isAttackMode);

  const getTitle = () => {
    if (isTravelMode) return "Travel";
    if (isExploreMode) return "Explore";
    if (isAttackMode) return "Attack";
    return "Select Action";
  };

  // const getHeadline = () => {
  //   if (isTravelMode || isExploreMode || isAttackMode) return "Select Hex";
  //   return "Choose an action";
  // };

  const arrivalTime = selectedEntity
    ? getComponentValue(ArrivalTime, getEntityIdFromKeys([selectedEntity.id]))
    : undefined;

  const weight = selectedEntity
    ? getComponentValue(Weight, getEntityIdFromKeys([selectedEntity.id]))
    : undefined;

  const quantity = selectedEntity
    ? getComponentValue(Quantity, getEntityIdFromKeys([selectedEntity.id]))
    : undefined;

  const capacity = selectedEntity
    ? getComponentValue(Capacity, getEntityIdFromKeys([selectedEntity.id]))
    : undefined;
  
  const totalCapacityInKg = divideByPrecision(Number(capacity?.weight_gram)) * Number(quantity?.value);
  const tickMove = selectedEntity ? getComponentValue(TickMove, getEntityIdFromKeys([selectedEntity.id])) : undefined;
  const isPassiveTravel = arrivalTime && nextBlockTimestamp ? arrivalTime.arrives_at > nextBlockTimestamp : false;

  const currentTick = nextBlockTimestamp ? Math.floor(nextBlockTimestamp / TIME_PER_TICK) : 0;
  const isActiveTravel = tickMove !== undefined && tickMove.tick >= currentTick;

  const isTraveling = isPassiveTravel || isActiveTravel;

  const sampleRewardResource: Resource = {resourceId: ResourcesIds.Ignium, amount: multiplyByPrecision(20)};
  const sampleRewardResourceWeightKg = getTotalResourceWeight([sampleRewardResource]);
  const entityWeightInKg = divideByPrecision(Number(weight?.value || 0));
  const canCarryNewReward 
      =  totalCapacityInKg 
          >= entityWeightInKg + sampleRewardResourceWeightKg;

  const onTravel = () => setIsTravelMode(true);
  const onExplore = () => setIsExploreMode(true);
  const onAttack = () => setIsAttackMode(true);
  const onClose = () => {
    setIsAttackMode(false);
    setIsExploreMode(false);
    setIsTravelMode(false);
    setSelectedEntity(undefined);
    setSelectedPath(undefined);
  };

  return (
    <SecondaryPopup className={"absolute !left-1/2 !top-[70px]"} name="explore">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">{getTitle()}</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"250px"} height={isExploreMode ? "280px" : "80px"}>
        {/* <div className="flex flex-col items-center mr-2">
          <div className="text-gold">{getHeadline()}</div>
        </div> */}
        {isTravelMode && <TravelPopup />}
        {isExploreMode && <ExploreMapPopup />}
        {!isTravelMode && !isExploreMode && !isAttackMode && (
          <div className="flex w-full items-center justify-center h-full mb-2">
            <div className="flex mt-1 w-[80%] items-center justify-between">
              <Button variant="primary" size="md" onClick={onTravel} disabled={isTraveling} className="">
                Travel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isTraveling || !canCarryNewReward}
                onClick={onExplore}
                className=""
              >
                Explore
              </Button>
              <Button variant="primary" size="md" disabled={true} onClick={onAttack} className="">
                Attack
              </Button>
            </div>
          </div>
        )}
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
