import { useResourceBalance } from "@/hooks/helpers/useResources";
import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { EternumGlobalConfig, Resource, ResourcesIds, WEIGHTS } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { getTotalResourceWeight } from "../cityview/realm/trade/utils";

export const TravelInfo = ({
  entityId,
  resources,
  travelTime,
  setCanCarry,
}: {
  entityId: bigint;
  resources: Resource[];
  travelTime?: number;
  setCanCarry?: (canContinue: boolean) => void;
}) => {
  const [resourceWeight, setResourceWeight] = useState(0);
  const [donkeyBalance, setDonkeyBalance] = useState(0);
  const neededDonkeys = Math.ceil(divideByPrecision(resourceWeight) / EternumGlobalConfig.carryCapacity.donkey);

  const { getBalance } = useResourceBalance();

  useEffect(() => {
    const totalWeight = getTotalResourceWeight(resources);
    const multipliedWeight = multiplyByPrecision(totalWeight);
    setResourceWeight(multipliedWeight);

    const { balance } = getBalance(entityId, ResourcesIds.Donkey);
    const currentDonkeyAmount = resources.find((r) => r.resourceId === ResourcesIds.Donkey)?.amount || 0;
    const calculatedDonkeyBalance = divideByPrecision(balance) - currentDonkeyAmount;
    setDonkeyBalance(calculatedDonkeyBalance);

    if (setCanCarry) {
      setCanCarry(calculatedDonkeyBalance >= neededDonkeys);
    }
  }, [resources, entityId, resourceWeight, donkeyBalance, setCanCarry]);

  return (
    <>
      <table className="min-w-full divide-y divide-gray-200 text-sm mt-2 text-center font-bold ">
        <tbody className=" divide-y divide-gray-200 ">
          {travelTime && (
            <tr>
              <td className="px-6 py-1 whitespace-nowrap  font-bold text-right">Travel Time</td>
              <td className="px-6 py-1 whitespace-nowrap text-gold text-left">
                {`${Math.floor(travelTime / 60)} hrs ${travelTime % 60} mins`}
              </td>
            </tr>
          )}

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
              {neededDonkeys} [{donkeyBalance}]{" "}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="flex text-xs mt-4 justify-center w-full gap-4 font-bold ">
        <div className="ml-2">Lords: {`${WEIGHTS[ResourcesIds.Lords]} kg/unit`}</div>
        <div>Food: {`${WEIGHTS[ResourcesIds.Wheat]} kg/unit`}</div>
        <div className="ml-2">Resource: {`${WEIGHTS[ResourcesIds.Wood]} kg/unit`}</div>
      </div>
    </>
  );
};
