import { useEffect, useMemo, useState } from "react";
import useUIStore from "../../../../hooks/store/useUIStore";
import clsx from "clsx";
import {
  type CombatInfo,
  type Resource,
  ResourcesIds,
  EXPLORATION_REWARD_RESOURCE_AMOUNT,
  EXPLORATION_COSTS,
} from "@bibliothecadao/eternum";
import { ResourceCost } from "../../../elements/ResourceCost";
import { divideByPrecision, getEntityIdFromKeys, multiplyByPrecision } from "../../../utils/utils";
import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useCombat } from "../../../../hooks/helpers/useCombat";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { getTotalResourceWeight } from "../../cityview/realm/trade/utils";
import { Html } from "@react-three/drei";
import { useResourceBalance, useResources } from "../../../../hooks/helpers/useResources";
import Button from "@/ui/elements/Button";

enum ArmyAction {
  Travel = "Travel",
  Explore = "Explore",
  Attack = "Attack",
}

export const ArmyMenu = () => {
  const {
    account: { account },
    setup: {
      components: { TickMove, ArrivalTime, Weight, Quantity, Capacity, EntityOwner, Owner, Position, Health, Realm },
    },
  } = useDojo();

  const [appeared, setAppeared] = useState(false);

  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const setIsAttackMode = useUIStore((state) => state.setIsAttackMode);
  const isAttackMode = useUIStore((state) => state.isAttackMode);
  const [playerOwnsSelectedEntity, setPlayerOwnsSelectedEntity] = useState(false);
  const [playerRaidersOnPosition, setPlayerRaidersOnPosition] = useState<CombatInfo[]>([]);
  const [selectedEntityIsDead, setSelectedEntityIsDead] = useState(true);
  const [selectedEntityIsRealm, setSelectedEntityIsRealm] = useState(false);
  const [selectedEntityRealmId, setSelectedEntityRealmId] = useState(0n);
  const [enemyRaidersOnPosition, setEnemyRaidersOnPosition] = useState<CombatInfo[]>([]);
  const { getEntitiesCombatInfo, getOwnerRaidersOnPosition } = useCombat();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const currentTick = useBlockchainStore((state) => state.currentTick);

  useEffect(() => {
    if (!selectedEntity) return;
    const checkPlayerOwnsSelectedEntity = () => {
      if (selectedEntity?.id) {
        const owner = getComponentValue(EntityOwner, getEntityIdFromKeys([selectedEntity.id])) || undefined;

        const entity_owner =
          getComponentValue(Owner, getEntityIdFromKeys([BigInt(owner?.entity_owner_id || "0")])) || undefined;
        return entity_owner?.address === BigInt(account.address) ? true : false;
      }
      return false;
    };

    if (!checkPlayerOwnsSelectedEntity()) {
      const selectedEntityPosition = getComponentValue(Position, getEntityIdFromKeys([selectedEntity.id]));
      const playerRaidersOnPosition = getOwnerRaidersOnPosition({
        x: selectedEntityPosition!.x,
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
      setSelectedEntityRealmId(realm.realm_id);
      setEnemyRaidersOnPosition([]);
    } else {
      setSelectedEntityIsRealm(false);
      setEnemyRaidersOnPosition(getEntitiesCombatInfo([selectedEntity.id]));
    }

    const entityHealth = getComponentValue(Health, getEntityIdFromKeys([selectedEntity?.id]));
    const selectedEntityIsDead = !entityHealth?.current;
    setSelectedEntityIsDead(selectedEntityIsDead);
  }, [selectedEntity]);

  const arrivalTime = selectedEntity
    ? getComponentValue(ArrivalTime, getEntityIdFromKeys([selectedEntity.id]))
    : undefined;

  const weight = selectedEntity ? getComponentValue(Weight, getEntityIdFromKeys([selectedEntity.id])) : undefined;
  const quantity = selectedEntity ? getComponentValue(Quantity, getEntityIdFromKeys([selectedEntity.id])) : undefined;
  const capacity = selectedEntity ? getComponentValue(Capacity, getEntityIdFromKeys([selectedEntity.id])) : undefined;
  const entityOwner = selectedEntity
    ? getComponentValue(EntityOwner, getEntityIdFromKeys([selectedEntity.id]))
    : undefined;

  const totalCapacityInKg = divideByPrecision(Number(capacity?.weight_gram)) * Number(quantity?.value);
  const tickMove = selectedEntity ? getComponentValue(TickMove, getEntityIdFromKeys([selectedEntity.id])) : undefined;
  const isPassiveTravel = arrivalTime && nextBlockTimestamp ? arrivalTime.arrives_at > nextBlockTimestamp : false;

  const isActiveTravel = tickMove !== undefined && tickMove.tick >= currentTick;

  const isTraveling = isPassiveTravel || isActiveTravel;

  const sampleRewardResource: Resource = {
    resourceId: ResourcesIds.Ignium,
    amount: multiplyByPrecision(EXPLORATION_REWARD_RESOURCE_AMOUNT),
  };

  const setTooltip = useUIStore((state) => state.setTooltip);

  const sampleRewardResourceWeightKg = getTotalResourceWeight([sampleRewardResource]);
  const entityWeightInKg = divideByPrecision(Number(weight?.value || 0));
  const canCarryNewReward = totalCapacityInKg >= entityWeightInKg + sampleRewardResourceWeightKg;

  const { getFoodResources } = useResourceBalance();

  const explorationCosts = useMemo(() => {
    const foodBalance = entityOwner ? getFoodResources(entityOwner.entity_owner_id) : [];
    return EXPLORATION_COSTS.map((res) => {
      return {
        ...res,
        hasEnough: (foodBalance.find((food: any) => food.resourceId === res.resourceId)?.amount || 0) >= res.amount,
      };
    });
  }, [entityOwner]);

  const hasEnoughResourcesToExplore = useMemo(() => {
    return explorationCosts.every((res) => res.hasEnough);
  }, [explorationCosts]);

  useEffect(() => {
    setTimeout(() => {
      setAppeared(true);
    }, 150);
    return () => {
      setAppeared(false);
    };
  }, []);

  return (
    <Html position={[0, 3, -0.5]}>
      <div
        className={clsx(
          "flex flex-col  -translate-x-1/2 transition-all duration-100 bg-brown",
          appeared ? "opacity-100" : "opacity-0 translate-y-1/2",
        )}
      >
        {!playerOwnsSelectedEntity && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setIsAttackMode(true);
            }}
            variant="primary"
          >
            Attack
          </Button>
        )}

        <Button
          disabled={isAttackMode || isTravelMode || isTraveling || !canCarryNewReward || !hasEnoughResourcesToExplore}
          onClick={(e) => {
            e.stopPropagation();
            if (!isAttackMode && !isTravelMode && !isTraveling && canCarryNewReward && hasEnoughResourcesToExplore) {
              if (isExploreMode) {
                setIsTravelMode(false);
                setIsExploreMode(false);
                setIsAttackMode(false);
              } else {
                setIsTravelMode(false);
                setIsExploreMode(true);
                setIsAttackMode(false);
              }
            }
          }}
          variant="primary"
        >
          <div className="flex items-center justify-between w-full">
            {isExploreMode ? "Exploring..." : "Explore"}
            <InfoIcon
              onMouseEnter={() => {
                setTooltip({
                  content: (
                    <ArmyActionInfo
                      entityId={entityOwner!.entity_owner_id}
                      costs={explorationCosts}
                      description="Explore the surroundings and find resources. Max 1 hex/tick"
                    />
                  ),
                  position: "right",
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
              className="w-4 h-4 ml-2"
            />
          </div>
        </Button>

        {playerOwnsSelectedEntity && (
          <Button
            disabled={isAttackMode || isExploreMode || isTraveling}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              if (isTravelMode) {
                setIsTravelMode(false);
                setIsExploreMode(false);
                setIsAttackMode(false);
              } else {
                setIsTravelMode(true);
                setIsExploreMode(false);
                setIsAttackMode(false);
              }
            }}
            variant="primary"
          >
            <div className="flex items-center justify-between w-full">
              <span>{isTravelMode || isTraveling ? "Traveling..." : "Travel"}</span>
              <InfoIcon
                onMouseEnter={() => {
                  setTooltip({
                    content: (
                      <ArmyActionInfo
                        entityId={entityOwner!.entity_owner_id}
                        costs={[]}
                        description="max 5 hexes/tick"
                      />
                    ),
                    position: "right",
                  });
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
                className="w-4 h-4 ml-2"
              />
            </div>
          </Button>
        )}
      </div>
    </Html>
  );
};

const ArmyActionInfo = ({
  entityId,
  costs,
  description,
}: {
  entityId: bigint;
  costs: Resource[];
  description?: string;
}) => {
  const { getBalance } = useResourceBalance();
  return (
    <div className="text-sm">
      <div className="text-center text-gray-500">{description}</div>
      {costs.length > 0 && (
        <>
          <div className="pt-3 font-bold w-full flex justify-center">Cost</div>
          <div className="grid grid-cols-2 gap-2">
            {costs.map((resource, index) => {
              const balance = getBalance(entityId || 0n, resource.resourceId);
              return (
                <ResourceCost
                  key={index}
                  type="horizontal"
                  resourceId={resource.resourceId}
                  amount={resource.amount}
                  balance={balance.balance}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
