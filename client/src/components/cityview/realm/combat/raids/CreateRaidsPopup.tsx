import { useEffect, useMemo, useState } from "react";
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
import { getResourceCost } from "../../../../../utils/combat";

type RoadBuildPopupProps = {
  //   toEntityId: number;
  onClose: () => void;
};

export const CreateRaidsPopup = ({ onClose }: RoadBuildPopupProps) => {
  const {
    setup: {
      components: { Resource },
      systemCalls: { create_soldiers },
    },
    account: { account },
  } = useDojo();

  const [canBuild, setCanBuild] = useState(true);
  const [loading, setLoading] = useState(false);
  const [soldierAmount, setSoldierAmount] = useState(2);

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
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build Battalion:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          {/* {toRealm && <Headline size="big">Build road to {realmsData["features"][toRealm.realmId - 1].name}</Headline>} */}
          <div className={"relative w-full mt-3"}>
            <img src={`/images/road.jpg`} className="object-cover w-full h-full rounded-[10px]" />
            <div className="flex flex-col p-2 left-2 bottom-2 rounded-[10px] bg-black/60">
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
            <div className="flex flex-col p-2 left-2 bottom-2 rounded-[10px] bg-black/60">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Stats:</div>
              <div className="grid grid-cols-4 gap-2">
                <div className="mb-1 ml-1 italic text-light-pink text-xxs">
                  <div> Attack: </div>
                  <div> {totalAttack}</div>
                  <div> Defence: </div>
                  <div> {totalDefence}</div>
                  <div> Health: </div>
                  <div> {totalHealth}</div>
                </div>
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
              onChange={setSoldierAmount}
              min={2}
              max={999}
              step={2}
            />
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="flex">
              {!loading && (
                <Button
                  className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                  onClick={onClose}
                  variant="outline"
                  withoutSound
                >
                  {`Cancel`}
                </Button>
              )}
              {!loading && (
                <Button
                  className="!px-[6px] !py-[2px] text-xxs ml-auto"
                  disabled={!canBuild}
                  onClick={onBuild}
                  variant="outline"
                  withoutSound
                >
                  {`Build Battalion`}
                </Button>
              )}
              {loading && (
                <Button
                  className="!px-[6px] !py-[2px] text-xxs ml-auto"
                  disabled={!canBuild}
                  isLoading={true}
                  variant="outline"
                  withoutSound
                >
                  {`Build Battalion`}
                </Button>
              )}
            </div>
            {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
