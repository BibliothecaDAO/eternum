import { useEffect, useMemo, useState } from "react";
import Button from "../../../../../elements/Button";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import { NumberInput } from "../../../../../elements/NumberInput";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { getBuildResourceCost } from "../../../../../utils/combat";
import { Headline } from "../../../../../elements/Headline";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { CombatInfo } from "@bibliothecadao/eternum";
import BlurryLoadingImage from "../../../../../elements/BlurryLoadingImage";

type MergeNewSoldiersPanelProps = {
  isDefence: boolean;
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const MergeNewSoldiersPanel = ({ isDefence, selectedRaider, onClose }: MergeNewSoldiersPanelProps) => {
  const {
    setup: {
      components: { Resource },
      systemCalls: { create_and_merge_soldiers },
    },
    account: { account },
  } = useDojo();

  const [canBuild, setCanBuild] = useState(true);
  const [loading, setLoading] = useState(false);
  const [soldierAmount, setSoldierAmount] = useState(1);
  const setTooltip = useUIStore((state) => state.setTooltip);
  let { realmEntityId } = useRealmStore();

  const [totalAttack, totalDefence, totalHealth, totalQuantity] = useMemo(() => {
    return [
      10 * soldierAmount + (selectedRaider.attack || 0),
      10 * soldierAmount + (selectedRaider.defence || 0),
      10 * soldierAmount + (selectedRaider.health || 0),
      soldierAmount + (selectedRaider.quantity || 0),
    ];
  }, [soldierAmount]);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  // TODO: get info from contract config file
  let costResources = useMemo(() => {
    return getBuildResourceCost(soldierAmount);
  }, [soldierAmount]);

  const onBuild = async () => {
    setLoading(true);
    if (selectedRaider.entityId) {
      await create_and_merge_soldiers({
        signer: account,
        realm_entity_id: BigInt(realmEntityId),
        quantity: BigInt(soldierAmount),
        merge_into_unit_id: selectedRaider.entityId,
      });
    }
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
    <div>
      <div className="flex flex-col items-center  h-[410px] p-2">
        <Headline>Military units</Headline>
        <div className="flex relative mt-1 justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold">{`x${totalQuantity} ${isDefence ? "Defenders" : "Raiders"}`}</div>
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
          <BlurryLoadingImage
            blurhash="LBHLO~W9x.F^Atoy%2Ri~TA0Myxt"
            height="340px"
            width="340px"
            src={`/images/units/troop.png`}
            imageStyleClass="object-cover w-full h-[340px] rounded-[10px]"
          ></BlurryLoadingImage>
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
              {`Build`}
            </Button>
          </div>
          {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
        </div>
      </div>
    </div>
  );
};
