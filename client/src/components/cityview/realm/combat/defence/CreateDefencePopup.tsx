import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import { NumberInput } from "../../../../../elements/NumberInput";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { Duty } from "@bibliothecadao/eternum";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";

type RoadBuildPopupProps = {
  watchTower: CombatInfo;
  onClose: () => void;
};

export const CreateDefencePopup = ({ watchTower, onClose }: RoadBuildPopupProps) => {
  const {
    setup: {
      systemCalls: { group_and_deploy_soldiers },
    },
    account: { account },
  } = useDojo();

  const [canBuild, setCanBuild] = useState(true);
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

  const onBuild = async () => {
    setLoading(true);
    await group_and_deploy_soldiers({
      signer: account,
      realm_entity_id: BigInt(realmEntityId),
      soldier_ids: realmBattalions.slice(0, soldierAmount).map((battalionId) => BigInt(battalionId)),
      duty: Duty.DEFEND,
    });
    setLoading(false);
    onClose();
  };

  useEffect(() => {
    setCanBuild(soldierAmount > 0);
  }, [soldierAmount]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build Defence:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <div className={"relative w-full mt-3"}>
            <img src={`/images/avatars/5.png`} className="object-cover w-full h-full rounded-[10px]" />
            <div className="flex flex-col p-2 left-2 bottom-2 rounded-[10px] bg-black/60">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Stats:</div>
              <div className="grid grid-cols-4 gap-2">
                <div className="mb-1 ml-1 italic text-light-pink text-xxs">
                  <div> New Attack: </div>
                  <div> {watchTower.attack || 0 + totalAttack}</div>
                  <div> New Defence: </div>
                  <div> {watchTower.defence || 0 + totalDefence}</div>
                  <div> New Health: </div>
                  <div> {watchTower.health || 0 + totalHealth}</div>
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
              onChange={(value) => setSoldierAmount(Math.min(realmBattalions.length, value))}
              min={0}
              max={999}
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
                  disabled={!canBuild}
                  onClick={onBuild}
                  variant="outline"
                  withoutSound
                >
                  {`Reinforce Defence`}
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
            {!canBuild && <div className="text-xxs text-order-giants/70">Add at least 1 battalion</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
