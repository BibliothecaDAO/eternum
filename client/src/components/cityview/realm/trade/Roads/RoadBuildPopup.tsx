import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import { Headline } from "../../../../../elements/Headline";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { NumberInput } from "../../../../../elements/NumberInput";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import * as realmsData from "../../../../../geodata/realms.json";
import { getRealm } from "../../SettleRealmComponent";

type RoadBuildPopupProps = {
  toRealmId: number;
  onClose: () => void;
};

export const RoadBuildPopup = ({ toRealmId, onClose }: RoadBuildPopupProps) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const [canBuild, setCanBuild] = useState(true);
  const [usageAmount, setUsageAmount] = useState(1);

  let { realmEntityId } = useRealmStore();

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);
  const toRealm = useMemo(() => (toRealmId ? getRealm(toRealmId) : undefined), [toRealmId]);

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  let costResources: { resourceId: number; amount: number }[] = [];

  for (const resourceIdCost of [2]) {
    const amount = 10;
    const totalAmount = amount * usageAmount;
    amount && costResources.push({ resourceId: resourceIdCost, amount: totalAmount });
  }

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
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build road:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline size="big">Build road to {toRealm && realmsData["features"][toRealm.realm_id - 1].name}</Headline>
          <div className={"relative w-full mt-3"}>
            <img src={`/images/road.jpg`} className="object-cover w-full h-full rounded-[10px]" />
            <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Price:</div>
              <div className="grid grid-cols-4 gap-2">
                {costResources.map(({ resourceId, amount }) => (
                  <ResourceCost key={resourceId} type="vertical" resourceId={resourceId} amount={amount} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <div className="flex items-center">
            <div className="italic text-light-pink">Amount</div>
            <NumberInput className="ml-2 mr-2" value={usageAmount} onChange={setUsageAmount} min={1} max={999} />
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
                onClick={() => {}}
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
