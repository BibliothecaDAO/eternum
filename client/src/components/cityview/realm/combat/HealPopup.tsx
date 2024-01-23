import { useEffect, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../utils/utils";
import { getHealResourceCost } from "../../../../utils/combat";
import { PercentageSelection } from "../../../../elements/PercentageSelection";
import ProgressBar from "../../../../elements/ProgressBar";
import { CombatInfo } from "@bibliothecadao/eternum";

type HealPopupProps = {
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const HealPopup = ({ selectedRaider, onClose }: HealPopupProps) => {
  const {
    setup: {
      components: { Resource },
      systemCalls: { heal_soldiers },
    },
    account: { account },
  } = useDojo();

  const [canHeal, setCanHeal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [healthAmount, setHealthAmount] = useState(1);
  const [percentage, setPercentage] = useState(0);
  const [newHealth, setNewHealth] = useState(selectedRaider.health);

  let { realmEntityId } = useRealmStore();

  const costResources = getHealResourceCost(healthAmount);

  useEffect(() => {
    setNewHealth(Math.max((selectedRaider.quantity * 10 * percentage) / 100, selectedRaider.health));
  }, [percentage]);

  useEffect(() => {
    setHealthAmount(newHealth - selectedRaider.health);
  }, [newHealth]);

  const onHeal = async () => {
    setLoading(true);
    await heal_soldiers({ signer: account, unit_id: selectedRaider.entityId, health_amount: healthAmount });
    onClose();
  };

  useEffect(() => {
    setCanHeal(false);
    costResources.forEach(({ resourceId, amount }) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );
      if (realmResource && realmResource.balance >= amount) {
        setCanHeal(true);
      }
    });
  }, [healthAmount]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Heal Units:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline>Heal Units</Headline>
          <div className={"relative w-full mt-3"}>
            <img src={`/images/units/troop-heal.png`} className="object-cover w-full h-full rounded-[10px]" />
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
        <div className="flex flex-col m-2 text-xxs">
          <div className="flex items-center w-full">
            <PercentageSelection
              percentages={[25, 50, 75, 100]}
              className={"ml-2 w-full"}
              setPercentage={setPercentage}
            ></PercentageSelection>
          </div>
          <div className="flex flex-row">
            <div className="flex items-center text-white mr-2">
              <div className="text-order-brilliance">{newHealth && newHealth.toLocaleString()}</div>&nbsp;/{" "}
              {10 * selectedRaider.quantity} HP
            </div>
            <div className="text-order-brilliance">{`+ ${healthAmount} HP`}</div>
          </div>
          {newHealth && (
            <div className="grid grid-cols-12 gap-0.5">
              <ProgressBar
                containerClassName="col-span-12 !bg-order-giants"
                rounded
                progress={(newHealth / (10 * selectedRaider.quantity)) * 100}
              />
            </div>
          )}
          <div className="flex flex-col mt-2 mr-1 items-end justify-center">
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
                disabled={!canHeal || healthAmount === 0}
                isLoading={loading}
                onClick={onHeal}
                variant="success"
                withoutSound
              >
                {`Heal`}
              </Button>
            </div>
            {!canHeal && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
