import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import {
  divideByPrecision,
  formatTimeLeftDaysHoursMinutes,
  getUIPositionFromColRow,
  multiplyByPrecision,
} from "../../utils/utils";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import Button from "../../elements/Button";
import { TravelPopup } from "./traveling/TravelPopup";
import { ExploreMapPopup } from "./explore/ExploreHexPopup";
import useBlockchainStore from "../../hooks/store/useBlockchainStore";
import { TIME_PER_TICK } from "../network/EpochCountdown";
import { getTotalResourceWeight } from "../cityview/realm/trade/utils";
import { CombatInfo, Resource, ResourcesIds, WEIGHTS } from "@bibliothecadao/eternum";
import useRealmStore from "../../hooks/store/useRealmStore";
import { useEffect, useState } from "react";
import { AttackRaidsPopup } from "../cityview/realm/combat/raids/AttackRaidsPopup";
import { useCombat } from "../../hooks/helpers/useCombat";
import { getRealmIdByPosition, getRealmNameById } from "../../utils/realms";

const EXPLORATION_REWARD_RESOURCE_AMOUNT: number = 20;

type ChooseArmyActionPopupProps = {};

export const ChooseArmyActionPopup = ({}: ChooseArmyActionPopupProps) => {
  const {
    setup: {
      components: { TickMove, ArrivalTime, Weight, Quantity, Capacity, EntityOwner, Position, Health, Realm },
    },
  } = useDojo();
  const [playerOwnsSelectedEntity, setPlayerOwnsSelectedEntity] = useState(false);
  const [playerRaidersOnPosition, setPlayerRaidersOnPosition] = useState<CombatInfo[]>([]);
  const [selectedEntityIsDead, setSelectedEntityIsDead] = useState(true);
  const [selectedEntityIsRealm, setSelectedEntityIsRealm] = useState(false);
  const [selectedEntityRealmId, setSelectedEntityRealmId] = useState(0n);
  const [enemyRaidersOnPosition, setEnemyRaidersOnPosition] = useState<CombatInfo[]>([]);

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const { getEntitiesCombatInfo, getOwnerRaidersOnPosition, getEntityWatchTowerId } = useCombat();

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

  useEffect(() => {
    const checkPlayerOwnsSelectedEntity = () => {
      if (selectedEntity?.id) {
        let entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([selectedEntity.id])) || undefined;
        let realmEntityIdsFlat = realmEntityIds.map((realmEntityId) => realmEntityId.realmEntityId);
        if (
          realmEntityIdsFlat.includes(entityOwner?.entity_owner_id!) ||
          realmEntityIdsFlat.includes(selectedEntity.id)
        ) {
          return true;
        }
      }
      return false;
    };

    if (!checkPlayerOwnsSelectedEntity()) {
      const selectedEntityPosition = getComponentValue(Position, getEntityIdFromKeys([selectedEntity!.id!]));
      let playerRaidersOnPosition = getOwnerRaidersOnPosition({
        x: selectedEntityPosition!.x!,
        y: selectedEntityPosition!.y,
      });
      setPlayerOwnsSelectedEntity(false);
      setPlayerRaidersOnPosition(getEntitiesCombatInfo(playerRaidersOnPosition));
    } else {
      setPlayerOwnsSelectedEntity(true);
    }

    // check if selected entity is a realm
    const realm = selectedEntity ? getComponentValue(Realm, getEntityIdFromKeys([selectedEntity.id])) : undefined;
    if (realm?.realm_id) {
      setSelectedEntityIsRealm(true);
      setSelectedEntityRealmId(realm!.realm_id!);
      setEnemyRaidersOnPosition([]);
    } else {
      setSelectedEntityIsRealm(false);
      setEnemyRaidersOnPosition(getEntitiesCombatInfo([selectedEntity!.id]));
    }

    const entityHealth = getComponentValue(Health, getEntityIdFromKeys([selectedEntity?.id!]));
    const selectedEntityIsDead = entityHealth?.value ? false : true;
    setSelectedEntityIsDead(selectedEntityIsDead);
  }, [selectedEntity]);

  const getTitle = () => {
    if (isTravelMode) return "Travel";
    if (isExploreMode) return "Explore";
    return "Select Action";
  };

  // const getHeadline = () => {
  //   if (isTravelMode || isExploreMode || isAttackMode) return "Select Hex";
  //   return "Choose an action";
  // };

  const arrivalTime = selectedEntity
    ? getComponentValue(ArrivalTime, getEntityIdFromKeys([selectedEntity.id]))
    : undefined;

  const weight = selectedEntity ? getComponentValue(Weight, getEntityIdFromKeys([selectedEntity.id])) : undefined;

  const quantity = selectedEntity ? getComponentValue(Quantity, getEntityIdFromKeys([selectedEntity.id])) : undefined;

  const capacity = selectedEntity ? getComponentValue(Capacity, getEntityIdFromKeys([selectedEntity.id])) : undefined;

  const totalCapacityInKg = divideByPrecision(Number(capacity?.weight_gram)) * Number(quantity?.value);
  const tickMove = selectedEntity ? getComponentValue(TickMove, getEntityIdFromKeys([selectedEntity.id])) : undefined;
  const isPassiveTravel = arrivalTime && nextBlockTimestamp ? arrivalTime.arrives_at > nextBlockTimestamp : false;

  const currentTick = nextBlockTimestamp ? Math.floor(nextBlockTimestamp / TIME_PER_TICK) : 0;
  const isActiveTravel = tickMove !== undefined && tickMove.tick >= currentTick;

  const isTraveling = isPassiveTravel || isActiveTravel;

  const sampleRewardResource: Resource = {
    resourceId: ResourcesIds.Ignium,
    amount: multiplyByPrecision(EXPLORATION_REWARD_RESOURCE_AMOUNT),
  };
  const sampleRewardResourceWeightKg = getTotalResourceWeight([sampleRewardResource]);
  const entityWeightInKg = divideByPrecision(Number(weight?.value || 0));
  const canCarryNewReward = totalCapacityInKg >= entityWeightInKg + sampleRewardResourceWeightKg;

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
    <>
      {isAttackMode && (
        <AttackRaidsPopup
          selectedRaider={playerRaidersOnPosition[0]}
          enemyRaider={enemyRaidersOnPosition[0]}
          onClose={onClose}
        />
      )}

      {!isAttackMode && !(selectedEntityIsRealm && playerOwnsSelectedEntity) && (
        <>
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

              {!selectedEntityIsRealm && playerOwnsSelectedEntity && !isTravelMode && !isExploreMode && (
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
                  </div>
                </div>
              )}

              {!playerOwnsSelectedEntity && !selectedEntityIsRealm && !isTravelMode && !isExploreMode && (
                <>
                  {playerRaidersOnPosition.length == 0 && (
                    <div className="text-xxs text-order-giants/70 mb-1">Your army must be on same position</div>
                  )}
                  {isTraveling && (
                    <div className="text-xxs text-order-giants/70 mb-1">The enemy raider is still traveling</div>
                  )}
                  <div className="flex w-full items-center justify-center h-full mb-2">
                    <div className="flex mt-1 items-center justify-between">
                      <Button
                        variant="primary"
                        size="md"
                        aria-label="you can only bleh"
                        disabled={playerRaidersOnPosition.length == 0 || isTraveling}
                        onClick={onAttack}
                        className=""
                      >
                        {selectedEntityIsDead ? "Steal from " : "Attack "}
                        Enemy Raider (#{selectedEntity?.id?.toString()})
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {!playerOwnsSelectedEntity && selectedEntityIsRealm && !isTravelMode && !isExploreMode && (
                <>
                  {playerRaidersOnPosition.length == 0 && (
                    <div className="text-xxs text-order-giants/70 mb-3">Your army must be on same position</div>
                  )}
                  <div className="flex w-full items-center justify-center h-full mb-2">
                    <div className="flex mt-1 items-center justify-between">
                      <Button
                        variant="primary"
                        size="md"
                        aria-label="you can only bleh"
                        disabled={playerRaidersOnPosition.length == 0 || isTraveling}
                        onClick={onAttack}
                        className=""
                      >
                        Attack {getRealmNameById(selectedEntityRealmId)}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </SecondaryPopup.Body>
          </SecondaryPopup>
        </>
      )}
    </>
  );
};
