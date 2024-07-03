import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { ArmyMode } from "@/hooks/store/_mapStore";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { EXPLORATION_COSTS, type Resource } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { useResourceBalance } from "../../../../hooks/helpers/useResources";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import useUIStore from "../../../../hooks/store/useUIStore";
import { ResourceCost } from "../../../elements/ResourceCost";
import { getEntityIdFromKeys } from "../../../utils/utils";

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
      components: { ArrivalTime, EntityOwner, Owner },
    },
  } = useDojo();

  const [appeared, setAppeared] = useState(false);

  const armyMode = useUIStore((state) => state.armyMode);
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
  const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([selectedEntityId]));

  const isPassiveTravel = useMemo(
    () => arrivalTime && nextBlockTimestamp && arrivalTime.arrives_at > nextBlockTimestamp,
    [arrivalTime, nextBlockTimestamp],
  );

  const isTraveling = useMemo(() => isPassiveTravel, [isPassiveTravel]);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const { getFoodResources } = useResourceBalance();

  const explorationCosts = useMemo(() => {
    const foodBalance = entityOwner ? getFoodResources(entityOwner.entity_owner_id) : [];
    return EXPLORATION_COSTS.map((res) => ({
      ...res,
      hasEnough: (foodBalance.find((food) => food.resourceId === res.resourceId)?.amount || 0) >= res.amount,
    }));
  }, [entityOwner, getFoodResources]);

  useEffect(() => {
    const timer = setTimeout(() => setAppeared(true), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <DojoHtml position={[0, 3, -0.5]}>
      <div
        className={clsx(
          "flex flex-col -translate-x-1/2 transition-all duration-100 ",
          appeared ? "opacity-100" : "opacity-0 translate-y-1/2",
        )}
      >
        <Button disabled={true} onClick={() => {}} variant="primary">
          <div className="flex items-center justify-between w-full">
            {armyMode === ArmyMode.Explore ? "Exploring..." : "Explore"}
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
          <Button disabled={true} onClick={() => {}} variant="primary">
            <div className="flex items-center justify-between w-full">
              <span>{armyMode === ArmyMode.Travel || isTraveling ? "Traveling..." : "Travel"}</span>
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
