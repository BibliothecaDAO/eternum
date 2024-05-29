import { useEffect, useMemo, useState } from "react";
import useUIStore from "../../../../hooks/store/useUIStore";
import clsx from "clsx";
import {
  type Resource,
  ResourcesIds,
  EXPLORATION_REWARD_RESOURCE_AMOUNT,
  EXPLORATION_COSTS,
  WeightConfig,
} from "@bibliothecadao/eternum";
import { ResourceCost } from "../../../elements/ResourceCost";
import { divideByPrecision, getEntityIdFromKeys, multiplyByPrecision } from "../../../utils/utils";
import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { useResourceBalance } from "../../../../hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { useStamina } from "@/hooks/helpers/useStamina";

const EXPLORE_DESCRIPTION = "Explore the area to discover resources. Limit: 1 hex per tick.";
const TRAVEL_DESCRIPTION = "Move to a new location. Limit: 5 hexes per tick.";

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
    <div className="text-sm p-3 shadow rounded-md">
      {description && <div className="text-center text-gray-500 mb-2">{description}</div>}
      {costs.length > 0 && (
        <>
          <div className="pt-2 font-bold text-center text-gray-700">Cost</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
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

export const ArmyMenu = ({ selectedEntityId }: { selectedEntityId: bigint }) => {
  const {
    account: { account },
    setup: {
      components: { ArrivalTime, Weight, Quantity, Capacity, EntityOwner, Owner },
    },
  } = useDojo();

  const [appeared, setAppeared] = useState(false);

  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const [playerOwnsSelectedEntity, setPlayerOwnsSelectedEntity] = useState(false);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  useEffect(() => {
    const fetchEntityDetails = () => {
      const owner = getComponentValue(EntityOwner, getEntityIdFromKeys([selectedEntityId])) || undefined;
      const entityOwner =
        getComponentValue(Owner, getEntityIdFromKeys([BigInt(owner?.entity_owner_id || "0")])) || undefined;
      const isPlayerOwner = entityOwner?.address === BigInt(account.address);
      setPlayerOwnsSelectedEntity(isPlayerOwner);
    };

    fetchEntityDetails();
  }, [selectedEntityId, account.address]);

  const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([selectedEntityId]));
  const weight = getComponentValue(Weight, getEntityIdFromKeys([selectedEntityId]));
  const quantity = getComponentValue(Quantity, getEntityIdFromKeys([selectedEntityId]));
  const capacity = getComponentValue(Capacity, getEntityIdFromKeys([selectedEntityId]));
  const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([selectedEntityId]));

  const totalCapacityInKg = useMemo(
    () => divideByPrecision(Number(capacity?.weight_gram)) * Number(quantity?.value),
    [capacity, quantity],
  );

  const isPassiveTravel = useMemo(
    () => arrivalTime && nextBlockTimestamp && arrivalTime.arrives_at > nextBlockTimestamp,
    [arrivalTime, nextBlockTimestamp],
  );

  const isTraveling = useMemo(() => isPassiveTravel, [isPassiveTravel]);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const entityWeightInKg = useMemo(() => divideByPrecision(Number(weight?.value || 0)), [weight]);

  const canCarryNewReward = useMemo(
    () => totalCapacityInKg >= entityWeightInKg + EXPLORATION_REWARD_RESOURCE_AMOUNT * WeightConfig[ResourcesIds.Wood],
    [totalCapacityInKg, entityWeightInKg],
  );

  const { getFoodResources } = useResourceBalance();

  const explorationCosts = useMemo(() => {
    const foodBalance = entityOwner ? getFoodResources(entityOwner.entity_owner_id) : [];
    return EXPLORATION_COSTS.map((res) => ({
      ...res,
      hasEnough: (foodBalance.find((food) => food.resourceId === res.resourceId)?.amount || 0) >= res.amount,
    }));
  }, [entityOwner, getFoodResources]);

  const hasEnoughResourcesToExplore = useMemo(() => explorationCosts.every((res) => res.hasEnough), [explorationCosts]);

  const isExploreDisabled = useMemo(
    () => isTravelMode || isTraveling || !canCarryNewReward || !hasEnoughResourcesToExplore,
    [isTravelMode, isTraveling, canCarryNewReward, hasEnoughResourcesToExplore],
  );

  const isTravelDisabled = useMemo(() => isExploreMode || isTraveling, [isExploreMode, isTraveling]);

  useEffect(() => {
    const timer = setTimeout(() => setAppeared(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const handleExploreClick = (e: any) => {
    e.stopPropagation();
    if (!isExploreDisabled) {
      setIsTravelMode(false);
      setIsExploreMode(!isExploreMode);
    }
  };

  const handleTravelClick = (e: any) => {
    e.stopPropagation();
    if (!isTravelDisabled) {
      setIsTravelMode(!isTravelMode);
      setIsExploreMode(false);
    }
  };

  return (
    <DojoHtml position={[0, 3, -0.5]}>
      <div
        className={clsx(
          "flex flex-col -translate-x-1/2 transition-all duration-100 ",
          appeared ? "opacity-100" : "opacity-0 translate-y-1/2",
        )}
      >
        <Button disabled={isExploreDisabled} onClick={handleExploreClick} variant="primary">
          <div className="flex items-center justify-between w-full">
            {isExploreMode ? "Exploring..." : "Explore"}
            <InfoIcon
              onMouseEnter={() =>
                setTooltip({
                  content: (
                    <ArmyActionInfo
                      entityId={entityOwner!.entity_owner_id}
                      costs={explorationCosts}
                      description={EXPLORE_DESCRIPTION}
                    />
                  ),
                  position: "right",
                })
              }
              onMouseLeave={() => setTooltip(null)}
              className="w-4 h-4 ml-2"
            />
          </div>
        </Button>

        {playerOwnsSelectedEntity && (
          <Button onClick={handleTravelClick} variant="primary">
            <div className="flex items-center justify-between w-full">
              <span>{isTravelMode || isTraveling ? "Traveling..." : "Travel"}</span>
              <InfoIcon
                onMouseEnter={() =>
                  setTooltip({
                    content: (
                      <ArmyActionInfo
                        entityId={entityOwner!.entity_owner_id}
                        costs={[]}
                        description={TRAVEL_DESCRIPTION}
                      />
                    ),
                    position: "right",
                  })
                }
                onMouseLeave={() => setTooltip(null)}
                className="w-4 h-4 ml-2"
              />
            </div>
          </Button>
        )}
      </div>
    </DojoHtml>
  );
};
