import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import { NumberInput } from "../../../../../elements/NumberInput";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { Duty } from "@bibliothecadao/eternum";
import { getResourceCost } from "../../../../../utils/combat";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";

type RoadBuildPopupProps = {
  selectedRaiders: CombatInfo;
  onClose: () => void;
};

export const ManageRaidsPopup = ({ selectedRaiders, onClose }: RoadBuildPopupProps) => {
  const {
    setup: {
      systemCalls: { ungroup_and_regroup_soldiers },
    },
    account: { account },
  } = useDojo();

  //   const [canBuild, setCanBuild] = useState(true);
  const [loading, setLoading] = useState(false);
  const [soldierAmount, setSoldierAmount] = useState(0);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { useRealmBattalions } = useCombat();

  const realmBattalions = useRealmBattalions(realmEntityId);

  const [totalAttack, totalDefence, totalHealth] = useMemo(() => {
    return [10 * soldierAmount, 10 * soldierAmount, 10 * soldierAmount];
  }, [soldierAmount]);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  const onChangeRaidersAmount = async () => {
    setLoading(true);
    const newAmount = soldierAmount + selectedRaiders.quantity;
    let new_soldier_ids = [];
    if (soldierAmount > 0) {
      for (let i = 0; i < newAmount - selectedRaiders.quantity; i++) {
        new_soldier_ids.push(realmBattalions[i]);
      }
    }
    await ungroup_and_regroup_soldiers({
      signer: account,
      group_id: selectedRaiders.entityId,
      realm_entity_id: realmEntityId,
      new_total_quantity: newAmount,
      new_soldier_ids,
      duty: Duty.ATTACK,
    });
    setLoading(false);
    onClose();
  };

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  //   let costResources = useMemo(() => {
  //     return getResourceCost(soldierAmount);
  //   }, [soldierAmount]);

  //   // check if can build
  //   useEffect(() => {
  //     let canBuild = true;

  //     costResources.forEach(({ resourceId, amount }) => {
  //       const realmResource = getComponentValue(
  //         Resource,
  //         getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
  //       );

  //       if (!realmResource || realmResource.balance < amount) {
  //         canBuild = false;
  //       }
  //     });

  //     setCanBuild(canBuild);
  //   }, [costResources]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Manage Raiders:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          {/* {toRealm && <Headline size="big">Build road to {realmsData["features"][toRealm.realmId - 1].name}</Headline>} */}
          <div className={"relative w-full mt-3"}>
            <img src={`/images/avatars/3.png`} className="object-cover w-full h-full rounded-[10px]" />
            {/* <div className="flex flex-col p-2 left-2 bottom-2 rounded-[10px] bg-black/60">
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
            </div> */}
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
            <div className="italic text-gold">Min {-selectedRaiders.quantity + 2}</div>
            <NumberInput
              className="ml-2 mr-2"
              value={soldierAmount}
              onChange={(value) => {
                const boundedValue = Math.max(-selectedRaiders.quantity + 2, value);
                const finalValue = Math.min(boundedValue, realmBattalions.length);
                setSoldierAmount(finalValue);
              }}
              min={-selectedRaiders.quantity + 2}
              max={realmBattalions.length}
              step={1}
            />
            <div className="italic text-gold">Max {realmBattalions.length}</div>
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
                  //   disabled={!canBuild}
                  onClick={onChangeRaidersAmount}
                  variant="outline"
                  withoutSound
                >
                  {`Modify Raiders`}
                </Button>
              )}
              {loading && (
                <Button
                  className="!px-[6px] !py-[2px] text-xxs ml-auto"
                  onClick={() => {}}
                  isLoading={true}
                  variant="outline"
                  withoutSound
                >
                  {`Build Battalion`}
                </Button>
              )}
            </div>
            {/* {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>} */}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
