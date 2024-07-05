import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { EternumGlobalConfig, Resource, ResourcesIds, WEIGHTS } from "@bibliothecadao/eternum";
import { getTotalResourceWeight } from "../cityview/realm/trade/utils";
import { useEffect, useState } from "react";
import { useResourceBalance } from "@/hooks/helpers/useResources";

export const TravelInfo = ({
  entityId,
  resources,
  travelTime,
  isPickup,
  setCanCarry,
}: {
  entityId: bigint;
  resources: Resource[];
  travelTime?: number;
  isPickup?: boolean;
  setCanCarry?: (canContinue: boolean) => void;
}) => {
  const [resourceWeight, setResourceWeight] = useState(0);
  const [donkeyBalance, setDonkeyBalance] = useState(0);
  const [sendingDonkeys, setSendingDonkeys] = useState(0);
  const neededDonkeys = Math.ceil(divideByPrecision(resourceWeight) / EternumGlobalConfig.carryCapacity.donkey);

  const { getBalance } = useResourceBalance();

  useEffect(() => {
    const updateResourceWeight = async () => {
      const totalWeight = getTotalResourceWeight(resources);
      const multipliedWeight = multiplyByPrecision(totalWeight);
      setResourceWeight(multipliedWeight);

      const { balance } = await getBalance(entityId, ResourcesIds.Donkey);
      const currentDonkeyAmount = isPickup
        ? 0
        : resources.find((r) => r.resourceId === ResourcesIds.Donkey)?.amount || 0;
      const calculatedDonkeyBalance = divideByPrecision(balance) - currentDonkeyAmount;
      setDonkeyBalance(calculatedDonkeyBalance);
      setSendingDonkeys(currentDonkeyAmount);

      if (setCanCarry) {
        setCanCarry(calculatedDonkeyBalance >= neededDonkeys);
      }
    };

    updateResourceWeight();
  }, [resources, entityId, resourceWeight, donkeyBalance, setCanCarry]);

  return (
    <>
      <table className="min-w-full divide-y divide-gray-200 text-sm mt-2 text-center font-bold ">
        <tbody className=" divide-y divide-gray-200 ">
          <tr>
            <td className="px-6 py-1 whitespace-nowrap  font-bold text-right">Travel Time</td>
            <td className="px-6 py-1 whitespace-nowrap text-gold text-left">
              {`${Math.floor(travelTime! / 60)} hrs ${travelTime! % 60} mins`}
            </td>
          </tr>

          <tr>
            <td className="px-6 py-1 whitespace-nowrap  font-bold text-right">Total Transfer Weight</td>
            <td className="px-6 py-1 whitespace-nowrap text-gold  text-left">{`${divideByPrecision(
              resourceWeight,
            )} kg`}</td>
          </tr>
          <tr>
            <td className="px-6 py-1 whitespace-nowrap  text-right">Donkeys Required for Transfer</td>
            <td
              className={`px-6 py-1 whitespace-nowrap text-gold text-left ${
                neededDonkeys > donkeyBalance ? "text-red" : "text-green"
              }`}
            >
              {neededDonkeys} + {sendingDonkeys} [{donkeyBalance}]{" "}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="flex text-xs mt-4 justify-center w-full gap-4 font-bold ">
        <div className="ml-2">Lords: {`${WEIGHTS[253]} kg/unit`}</div>
        <div>Food: {`${WEIGHTS[254]} kg/unit`}</div>
        <div className="ml-2">Resource: {`${WEIGHTS[1]} kg/unit`}</div>
      </div>
    </>
  );
};
