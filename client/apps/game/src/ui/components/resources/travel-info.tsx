import { ResourceIcon } from "@/ui/elements/resource-icon";
import { calculateArrivalTime, formatArrivalTime } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  calculateDonkeysNeeded,
  configManager,
  divideByPrecision,
  getBalance,
  getTotalResourceWeightKg,
} from "@bibliothecadao/eternum";
import {

  ResourcesIds,
  type ID,
  type Resource,
} from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { useEffect, useMemo, useState } from "react";

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
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const [resourceWeightKg, setResourceWeightKg] = useState(0);
  const [donkeyBalance, setDonkeyBalance] = useState(0);
  const neededDonkeys = useMemo(() => calculateDonkeysNeeded(resourceWeightKg), [resourceWeightKg]);

  const arrivalTime = calculateArrivalTime(travelTime);
  const formattedArrivalTime = formatArrivalTime(arrivalTime);

  useEffect(() => {
    const totalWeight = getTotalResourceWeightKg(resources);
    setResourceWeightKg(totalWeight);

    const { balance } = getBalance(entityId, ResourcesIds.Donkey, currentDefaultTick, dojo.setup.components);

    const currentDonkeyAmount = isAmm ? 0 : resources.find((r) => r.resourceId === ResourcesIds.Donkey)?.amount || 0;

    const calculatedDonkeyBalance = divideByPrecision(balance) - currentDonkeyAmount;

    setDonkeyBalance(calculatedDonkeyBalance);

    const onlyDonkeysAndLords = resources.every(
      (r) => r.resourceId === ResourcesIds.Donkey || r.resourceId === ResourcesIds.Lords,
    );

    if (setCanCarry) {
      // TODO: hacky way to set can carry to true if only donkeys and lords
      onlyDonkeysAndLords ? setCanCarry(true) : setCanCarry(calculatedDonkeyBalance >= neededDonkeys);
    }
  }, [resources, entityId, resourceWeightKg, donkeyBalance, setCanCarry]);

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <tbody className="divide-y divide-gold/20">
          {formattedArrivalTime ? (
            <tr className="hover:bg-gold/5 transition-colors">
              <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Estimated Arrival</td>
              <td className="px-4 py-1 text-gold text-left whitespace-nowrap">{formattedArrivalTime}</td>
            </tr>
          ) : (
            ""
          )}
          <tr className="hover:bg-gold/5 transition-colors">
            <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Total Transfer Weight</td>
            <td className="px-4 py-1 text-gold text-left whitespace-nowrap">{`${resourceWeightKg} kg`}</td>
          </tr>
          <tr className="hover:bg-gold/5 transition-colors">
            <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Donkeys Burnt for Transfer</td>
            <td
              className={`px-4 py-1 whitespace-nowrap text-left ${neededDonkeys > donkeyBalance ? "text-red" : "text-green"
                }`}
            >
              {neededDonkeys.toLocaleString()} 🔥🫏 [{donkeyBalance.toLocaleString()}]
            </td>
          </tr>
        </tbody>
      </table>
      <ResourceWeight className="mt-2 text-xs opacity-75" />
    </>
  );
};

const ResourceWeight = ({ className }: { className?: string }) => {
  return (
    <div className={`text-xs text-gray-200 p-2 max-w-xs ${className}`}>
      <p className="font-semibold">Resource Weights</p>
      <div className="grid grid-cols-2 gap-x-4 my-1">
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeightKg(ResourcesIds.Lords)} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wheat]} size="xs" className="mr-1" />
            {`(Food) ${configManager.getResourceWeightKg(ResourcesIds.Wheat)} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wood]} size="xs" className="mr-1" />
            {`(Other) ${configManager.getResourceWeightKg(ResourcesIds.Wood)} kg/unit`}
          </li>
        </ul>
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeightKg(ResourcesIds.Knight)} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Crossbowman]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeightKg(ResourcesIds.Crossbowman)} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Paladin]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeightKg(ResourcesIds.Paladin)} kg/unit`}
          </li>
        </ul>
      </div>
      <p className="italic text-xs">Each resource has a different weight per unit.</p>
    </div>
  );
};
