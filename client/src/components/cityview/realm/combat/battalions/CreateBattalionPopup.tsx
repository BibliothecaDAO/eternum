import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { NumberInput } from "../../../../../elements/NumberInput";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { getResourceCost } from "../../../../../utils/combat";
import { Headline } from "../../../../../elements/Headline";
import useUIStore from "../../../../../hooks/store/useUIStore";

type RoadBuildPopupProps = {
  //   toEntityId: number;
  onClose: () => void;
};

export const CreateBattalionPopup = ({ onClose }: RoadBuildPopupProps) => {
  const {
    setup: {
      components: { Resource },
      systemCalls: { create_soldiers },
    },
    account: { account },
  } = useDojo();

  const [canBuild, setCanBuild] = useState(true);
  const [loading, setLoading] = useState(false);
  const [soldierAmount, setSoldierAmount] = useState(1);
  const setTooltip = useUIStore((state) => state.setTooltip);
  let { realmEntityId } = useRealmStore();

  const [totalAttack, totalDefence, totalHealth] = useMemo(() => {
    return [10 * soldierAmount, 10 * soldierAmount, 10 * soldierAmount];
  }, [soldierAmount]);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  let costResources = useMemo(() => {
    return getResourceCost(soldierAmount);
  }, [soldierAmount]);

  const onBuild = async () => {
    setLoading(true);
    await create_soldiers({ signer: account, realm_entity_id: BigInt(realmEntityId), quantity: BigInt(soldierAmount) });
    setLoading(false);
    onClose();
  };

  // check if can build
  useEffect(() => {
    let canBuild = true;

    costResources.forEach(({ resourceId, amount }) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );

      if (!realmResource || realmResource.balance < amount) {
        canBuild = false;
      }
    });

    setCanBuild(canBuild);
  }, [costResources]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build Battalion:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline size="big">Military units</Headline>
          <div className="flex relative mt-1 justify-between text-xxs text-lightest w-full">
            <div className="flex items-center">
              <div className="flex items-center h-6 mr-2">
                <img src="/images/units/troop-icon.png" className="h-[28px]" />
                <div className="flex flex-col ml-1 text-center">
                  <div className="bold">Warrior</div>
                </div>
              </div>
            </div>
            <div className="flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
              <div
                className="flex items-center h-6 mr-2"
                onMouseEnter={() =>
                  setTooltip({
                    position: "top",
                    content: (
                      <>
                        <p className="whitespace-nowrap">Attack power</p>
                      </>
                    ),
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              >
                <img src="/images/icons/attack.png" className="h-full" />
                <div className="flex flex-col ml-1 text-center">
                  <div className="bold ">{totalAttack}</div>
                </div>
              </div>
              <div
                className="flex items-center h-6 mr-2"
                onMouseEnter={() =>
                  setTooltip({
                    position: "top",
                    content: (
                      <>
                        <p className="whitespace-nowrap">Defence power</p>
                      </>
                    ),
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              >
                <img src="/images/icons/defence.png" className="h-full" />
                <div className="flex flex-col ml-1 text-center">
                  <div className="bold ">{totalDefence}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center">{totalHealth} HP</div>
          </div>
          <div className={"relative w-full mt-3"}>
            <img src={`/images/units/troop.png`} className="object-cover w-full h-full rounded-[10px]" />
            <div className="flex absolute flex-col p-2 left-2 bottom-2 rounded-[10px] bg-black/60">
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
              value={soldierAmount}
              onChange={(value) => setSoldierAmount(Math.max(value, 1))}
              min={1}
              max={999}
              step={1}
            />
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="flex">
              <Button className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto" onClick={onClose} variant="outline">
                {`Cancel`}
              </Button>
              <Button
                className="!px-[6px] !py-[2px] text-xxs ml-auto"
                disabled={!canBuild}
                onClick={onBuild}
                variant="outline"
                isLoading={loading}
              >
                {`Build Battalions`}
              </Button>
            </div>
            {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
