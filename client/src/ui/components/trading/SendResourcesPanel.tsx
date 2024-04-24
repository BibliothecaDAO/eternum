import { useEffect, useMemo, useState } from "react";
import Button from "../../elements/Button";
import { getComponentValue } from "@dojoengine/recs";
import { divideByPrecision, getEntityIdFromKeys, multiplyByPrecision } from "../../utils/utils";
import { useDojo } from "../../../hooks/context/DojoContext";
import { Headline } from "../../elements/Headline";
import { resources } from "@bibliothecadao/eternum";
import { ResourceCost } from "../../elements/ResourceCost";
import clsx from "clsx";
import { NumberInput } from "../../elements/NumberInput";
import { PercentageSelection } from "../../elements/PercentageSelection";
import { ResourceWeightsInfo } from "../resources/ResourceWeight";

export const SendResourcesPanel = ({
  senderEntityId,
  position,
  onSendResources,
}: {
  senderEntityId: bigint;
  position: { x: number; y: number } | undefined;
  onSendResources: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [canCarry, setCanCarry] = useState(false);

  const {
    account: { account },
    setup: {
      systemCalls: { send_resources },
    },
  } = useDojo();

  const sendResources = async () => {
    if (!position) return;
    setIsLoading(true);
    const resourcesList = Object.keys(feedResourcesGiveAmounts)
      .filter((id) => feedResourcesGiveAmounts[Number(id)] > 0)
      .flatMap((id) => [Number(id), multiplyByPrecision(feedResourcesGiveAmounts[Number(id)])]);
    await send_resources({
      signer: account,
      sender_entity_id: senderEntityId,
      // todo: change that
      recipient_entity_id: 0,
      resources: resourcesList || [],
    });
    onSendResources();
  };

  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const [percentage, setPercentage] = useState<number>(0);
  const [feedResourcesGiveAmounts, setFeedResourcesGiveAmounts] = useState<{ [key: number]: number }>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 0,
    14: 0,
    15: 0,
    16: 0,
    17: 0,
    18: 0,
    19: 0,
    20: 0,
    21: 0,
    22: 0,
  });

  const totalResources = useMemo(() => {
    const totalResources: Record<string, number> = {};
    resources.forEach((resource) => {
      let resourceAmount = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(senderEntityId), BigInt(resource.id)]),
      );
      if (!resourceAmount || resourceAmount.balance === 0n) return;
      totalResources[resource.id] = Number(resourceAmount.balance);
    });
    return totalResources;
  }, []);

  useEffect(() => {
    const feedResourcesGiveAmounts: Record<string, number> = {};
    Object.keys(totalResources).forEach((id) => {
      feedResourcesGiveAmounts[id] = Math.floor(divideByPrecision((totalResources[id] * percentage) / 100));
    });
    setFeedResourcesGiveAmounts(feedResourcesGiveAmounts);
  }, [percentage]);

  return (
    <div className="flex flex-col items-center p-2">
      <>
        <>
          <div className="grid relative grid-cols-9 gap-2 max-h-[350px] overflow-auto">
            <div className={clsx("flex flex-col items-center  space-y-2 h-min", "col-span-4")}>
              <Headline className="mb-2">You Give</Headline>
              {Object.keys(totalResources).map((_id) => {
                const id: any = Number(_id);
                return (
                  <div key={id} className="flex items-center w-full h-8">
                    <NumberInput
                      max={totalResources[id]}
                      min={1}
                      value={feedResourcesGiveAmounts[id]}
                      onChange={(value) => {
                        setFeedResourcesGiveAmounts({
                          ...feedResourcesGiveAmounts,
                          [id]: Math.min(divideByPrecision(totalResources[id] || 0), value),
                        });
                      }}
                    />
                    <div className="ml-2">
                      <ResourceCost
                        className=" cursor-pointer"
                        onClick={() => {
                          setFeedResourcesGiveAmounts({
                            ...feedResourcesGiveAmounts,
                            [id]: divideByPrecision(totalResources[id] || 0),
                          });
                        }}
                        resourceId={id}
                        amount={divideByPrecision(totalResources[id] || 0)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
        <PercentageSelection percentages={[0, 25, 50, 75, 100]} setPercentage={setPercentage}></PercentageSelection>
      </>
      <ResourceWeightsInfo
        entityId={senderEntityId}
        resources={Object.keys(feedResourcesGiveAmounts).map((resourceId) => {
          return {
            resourceId: Number(resourceId),
            amount: feedResourcesGiveAmounts[Number(resourceId)],
          };
        })}
        setCanCarry={setCanCarry}
      />
      <div className="flex justify-between items-center mt-3 w-full text-xxs">
        {!isLoading && (
          <Button
            className="!px-[6px] !py-[2px] text-xxs ml-auto"
            disabled={!canCarry}
            isLoading={isLoading}
            onClick={() => {
              sendResources();
            }}
            variant={canCarry ? "success" : "outline"}
          >
            {"Send Caravan"}
          </Button>
        )}
        {isLoading && (
          <Button
            isLoading={true}
            onClick={() => {}}
            variant="danger"
            className="ml-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {" "}
            {}{" "}
          </Button>
        )}
      </div>
    </div>
  );
};
