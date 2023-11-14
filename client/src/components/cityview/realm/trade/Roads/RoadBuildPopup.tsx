import { useEffect, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import { Headline } from "../../../../../elements/Headline";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { NumberInput } from "../../../../../elements/NumberInput";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import * as realmsData from "../../../../../geodata/realms.json";
import { ROAD_COST_PER_USAGE } from "@bibliothecadao/eternum";

type RoadBuildPopupProps = {
  toEntityId: number;
  onClose: () => void;
};

export const RoadBuildPopup = ({ toEntityId, onClose }: RoadBuildPopupProps) => {
  const {
    setup: {
      components: { Resource },
      systemCalls: { create_road },
      optimisticSystemCalls: { optimisticBuildRoad },
    },
    account: { account },
  } = useDojo();

  const [canBuild, setCanBuild] = useState(true);
  const [usageAmount, setUsageAmount] = useState(2);

  let { realmEntityId } = useRealmStore();

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);
  const { realm: toRealm } = useGetRealm(toEntityId);

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  let costResources: { resourceId: number; amount: number }[] = [];

  for (const resourceIdCost of [2]) {
    const totalAmount = ROAD_COST_PER_USAGE * usageAmount;
    costResources.push({ resourceId: resourceIdCost, amount: totalAmount });
  }

  const onBuild = () => {
    if (realm && toRealm) {
      const start_position = realm.position;
      const end_position = toRealm.position;
      optimisticBuildRoad(create_road)({
        signer: account,
        creator_id: realmEntityId,
        start_coord: start_position,
        end_coord: end_position,
        usage_count: usageAmount,
      });
      onClose();
    }
  };

  useEffect(() => {
    setCanBuild(false);
    costResources.forEach(({ resourceId, amount }) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );
      if (realmResource && realmResource.balance >= amount) {
        setCanBuild(true);
      }
    });
  }, [usageAmount]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build road:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          {toRealm && (
            <Headline size="big">Build road to {toRealm && realmsData["features"][toRealm.realmId - 1].name}</Headline>
          )}
          <div className={"relative w-full mt-3"}>
            <img src={`/images/road.jpg`} className="object-cover w-full h-full rounded-[10px]" />
            <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Price:</div>
              <div className="grid grid-cols-4 gap-2">
                {costResources.map(({ resourceId, amount }) => (
                  <ResourceCost
                    key={resourceId}
                    type="vertical"
                    resourceId={resourceId}
                    amount={divideByPrecision(amount)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <div className="flex items-center">
            <div className="italic text-light-pink">Amount</div>
            <NumberInput
              className="ml-2 mr-2"
              value={usageAmount}
              onChange={setUsageAmount}
              min={2}
              max={999}
              step={2}
            />
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="flex">
              <Button
                className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                onClick={onClose}
                variant="outline"
                withoutSound
              >
                {`Cancel`}
              </Button>

              <Button
                className="!px-[6px] !py-[2px] text-xxs ml-auto"
                disabled={!canBuild}
                onClick={onBuild}
                variant="outline"
                withoutSound
              >
                {`Build road`}
              </Button>
            </div>
            {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
