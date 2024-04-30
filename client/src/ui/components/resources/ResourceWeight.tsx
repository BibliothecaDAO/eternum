import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { Resource, WEIGHTS, WEIGHT_PER_DONKEY_KG } from "@bibliothecadao/eternum";
import { getTotalResourceWeight } from "../cityview/realm/trade/utils";
import { useEffect, useState } from "react";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";

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
    const updateResourceWeight = async () => {
      const totalWeight = getTotalResourceWeight(resources);
      const multipliedWeight = multiplyByPrecision(totalWeight);
      setResourceWeight(multipliedWeight);

      const { balance } = await getBalance(entityId, 249);
      const currentDonkeyAmount = resources.find((r) => r.resourceId === 249)?.amount || 0;
      const calculatedDonkeyBalance = divideByPrecision(balance) - currentDonkeyAmount;
      setDonkeyBalance(calculatedDonkeyBalance);

      if (setCanCarry) {
        console.log({ donkeyBalance, neededDonkeys });
        setCanCarry(calculatedDonkeyBalance >= neededDonkeys);
      }
    };

    updateResourceWeight();
  }, [resources, entityId, resourceWeight, donkeyBalance, setCanCarry]);

  return (
    <>
      <Headline>Transfer Details</Headline>
      <table className="min-w-full divide-y divide-gray-200 text-xs mt-2 text-center">
        <tbody className=" divide-y divide-gray-200 border">
          <tr>
            <td className="px-6 py-1 whitespace-nowrap border font-bold text-right">Total Weight</td>
            <td className="px-6 py-1 whitespace-nowrap text-gold  text-left">{`${divideByPrecision(
              resourceWeight,
            )} kg`}</td>
          </tr>
          <tr>
            <td className="px-6 py-1 whitespace-nowrap border font-bold  text-right">Donkeys Required</td>
            <td
              className={`px-6 py-1 whitespace-nowrap text-gold text-left text-order-${
                neededDonkeys > donkeyBalance ? "giants" : "brilliance"
              }`}
            >
              {neededDonkeys} [{donkeyBalance}]{" "}
            </td>
          </tr>

          {/* <tr>
            <td className="px-6 py-1 whitespace-nowrap border font-bold">Food</td>
            <td className="px-6 py-1 whitespace-nowrap text-gold">{`${WEIGHTS[254]} kg/unit`}</td>
          </tr>
          <tr>
            <td className="px-6 py-1 whitespace-nowrap border font-bold">Resource</td>
            <td className="px-6 py-1 whitespace-nowrap text-gold">{`${WEIGHTS[1]} kg/unit`}</td>
          </tr>
          <tr>
            <td className="px-6 py-1 whitespace-nowrap border font-bold">Lords</td>
            <td className="px-6 py-1 whitespace-nowrap text-gold">{`${WEIGHTS[253]} kg/unit`}</td>
          </tr> */}
        </tbody>
      </table>
      <div className="flex text-xs my-2 justify-between w-full">
        <div>Food: {`${WEIGHTS[254]} kg/unit`}</div>
        <div className="ml-2">Resource: {`${WEIGHTS[1]} kg/unit`}</div>
        <div className="ml-2">Lords: {`${WEIGHTS[253]} kg/unit`}</div>
      </div>
    </>
  );
};
