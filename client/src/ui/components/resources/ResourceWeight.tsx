import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { Resource, WEIGHTS, WEIGHT_PER_DONKEY_KG } from "@bibliothecadao/eternum";
import { getTotalResourceWeight } from "../cityview/realm/trade/utils";
import { useEffect, useState } from "react";
import { useResourceBalance } from "@/hooks/helpers/useResources";

export const ResourceWeightsInfo = ({
  entityId,
  resources,
  setCanCarry,
}: {
  entityId: bigint;
  resources: Resource[];
  setCanCarry?: (canContinue: boolean) => void;
}) => {
  const [resourceWeight, setResourceWeight] = useState(0);
  const [donkeyBalance, setDonkeyBalance] = useState(0);
  const neededDonkeys = Math.ceil(divideByPrecision(resourceWeight) / WEIGHT_PER_DONKEY_KG);

  const { getBalance } = useResourceBalance();

  useEffect(() => {
    // set resource weight in kg
    setResourceWeight(multiplyByPrecision(getTotalResourceWeight(resources)));
    setDonkeyBalance(
      divideByPrecision(getBalance(entityId, 249).balance) - (resources.find((r) => r.resourceId === 249)?.amount || 0),
    );

    if (setCanCarry) {
      setCanCarry(donkeyBalance >= neededDonkeys);
    }
  }, [resources]);

  return (
    <>
      <div className="flex text-xs mt-2 text-center text-white">
        Total Items Weight <div className="ml-1 text-gold">{`${divideByPrecision(resourceWeight)}kg`}</div>
      </div>
      <div className="flex my-1 flex-row text-xxs text-center text-white">
        <div className="flex flex-col mx-1">
          <div> Food</div>
          <div className="ml-1 text-gold">{`${WEIGHTS[254]}kg/unit`}</div>
        </div>
        <div className="flex flex-col mx-1">
          <div> Resource</div>
          <div className="ml-1 text-gold">{`${WEIGHTS[1]}kg/unit`}</div>
        </div>
        <div className="flex flex-col mx-1">
          <div> Lords</div>
          <div className="ml-1 text-gold">{`${WEIGHTS[253]}kg/unit`}</div>
        </div>
      </div>
      <div className={`text-order-${neededDonkeys > donkeyBalance ? "giants" : "brilliance"}`}>
        <div className="flex mb-1 text-xs text-center">{neededDonkeys} Donkeys needed</div>
        <div className="flex mb-1 text-xs text-center">Donkey Balance : {donkeyBalance}</div>
      </div>
    </>
  );
};
