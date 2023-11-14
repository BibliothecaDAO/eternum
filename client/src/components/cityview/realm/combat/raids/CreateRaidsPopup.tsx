import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import { NumberInput } from "../../../../../elements/NumberInput";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { Duty } from "@bibliothecadao/eternum";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { Headline } from "../../../../../elements/Headline";
import useUIStore from "../../../../../hooks/store/useUIStore";

type RoadBuildPopupProps = {
  onClose: () => void;
};

export const CreateRaidsPopup = ({ onClose }: RoadBuildPopupProps) => {
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
  const setTooltip = useUIStore((state) => state.setTooltip);

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
      duty: Duty.ATTACK,
    });
    setLoading(false);
    onClose();
  };

  // check if can build
  useEffect(() => {
    if (soldierAmount > 1) {
      setCanBuild(true);
    } else {
      setCanBuild(false);
    }
  }, [soldierAmount]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build Raiders:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline size="big">Create raid group</Headline>
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
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Available</div>
              <div className="flex items-center">
                <div className="flex flex-col text-xxs items-center text-white">
                  <div className="font-bold">x{realmBattalions.length}</div>
                  Battalions
                </div>
                <img src="/images/units/troop-icon.png" className="h-[40px]" />
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
            <div className="flex w-full">
              {!loading && (
                <Button className="ml-auto mr-2" size="xs" onClick={onClose} variant="outline" withoutSound>
                  {`Cancel`}
                </Button>
              )}
              <Button disabled={!canBuild} size="xs" onClick={onBuild} variant="outline" isLoading={loading}>
                {`Create group`}
              </Button>
            </div>
            {!canBuild && <div className="text-xxs text-order-giants/70">At least 2 battalion to create raiders</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
