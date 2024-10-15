import { configManager } from "@/dojo/setup";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { GRAMS_PER_KG } from "@/ui/constants";
import { divideByPrecision, formatNumber, getTotalResourceWeight, multiplyByPrecision } from "@/ui/utils/utils";
import { CapacityConfigCategory, ResourcesIds, WEIGHTS_GRAM, type ID, type Resource } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";

export const TravelInfo = ({
  entityId,
  resources,
  travelTime,
  setCanCarry,
  isAmm,
}: {
  entityId: ID;
  resources: Resource[];
  travelTime?: number;
  setCanCarry?: (canContinue: boolean) => void;
  isAmm?: boolean;
}) => {
  const [resourceWeight, setResourceWeight] = useState(0);
  const [donkeyBalance, setDonkeyBalance] = useState(0);
  const neededDonkeys = Math.ceil(
    divideByPrecision(resourceWeight) / configManager.getCapacityConfig(CapacityConfigCategory.Donkey),
  );

  const { getBalance } = getResourceBalance();

  useEffect(() => {
    const totalWeight = getTotalResourceWeight(resources);
    const multipliedWeight = multiplyByPrecision(totalWeight);
    setResourceWeight(multipliedWeight);

    const { balance } = getBalance(entityId, ResourcesIds.Donkey);
    const currentDonkeyAmount = isAmm ? 0 : resources.find((r) => r.resourceId === ResourcesIds.Donkey)?.amount || 0;
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
            <td className="px-6 py-1 whitespace-nowrap text-gold  text-left">{`${formatNumber(
              divideByPrecision(resourceWeight) / GRAMS_PER_KG,
              0,
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
      <ResourceWeight className="mt-4 text-xs" />
    </>
  );
};

export const ResourceWeight = ({ className }: { className?: string }) => {
  return (
    <div className={`flex justify-center w-full gap-4 font-bold ${className}`}>
      <div className="ml-2">Lords: {`${WEIGHTS_GRAM[ResourcesIds.Lords] / GRAMS_PER_KG} kg/unit`}</div>
      <div>Food: {`${WEIGHTS_GRAM[ResourcesIds.Wheat] / GRAMS_PER_KG} kg/unit`}</div>
      <div className="ml-2">Resource: {`${WEIGHTS_GRAM[ResourcesIds.Wood] / GRAMS_PER_KG} kg/unit`}</div>
    </div>
  );
};
